"""Publish release notes to Nostr relays when games go live."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from time import perf_counter
from typing import Any, Mapping, Protocol

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from proof_of_play_api.core.config import (
    NostrPublisherSettings,
    get_nostr_publisher_settings,
)
from proof_of_play_api.core.metrics import MetricsClient, get_metrics_client
from proof_of_play_api.db.models import Game, ReleaseNotePublishQueue
from proof_of_play_api.services.nostr import calculate_event_id, schnorr_sign

NOSTR_KIND_RELEASE_NOTE = 30023
PUBLISH_QUEUE_ALERT_THRESHOLD = 25


logger = logging.getLogger(__name__)


class ReleaseNotePublishError(RuntimeError):
    """Base error raised when release notes cannot be dispatched."""


class RelayPublishError(ReleaseNotePublishError):
    """Raised when a relay rejects or fails to accept an event."""


class _RelayResponse(Protocol):
    """Subset of HTTP response interface required for publishing."""

    status_code: int
    text: str


class _RelayClient(Protocol):
    """Protocol describing the HTTP client used to publish events."""

    def post(self, url: str, *, json: Any, timeout: float) -> _RelayResponse:
        """Send a JSON payload to the relay returning its response."""


@dataclass(frozen=True)
class PublishOutcome:
    """Result information after attempting to publish a release note."""

    event: Mapping[str, Any]
    successful_relays: tuple[str, ...]
    failed_relays: tuple[str, ...]


class ReleaseNotePublisher:
    """Compose, sign, and publish release notes for newly listed games."""

    def __init__(
        self,
        *,
        client: _RelayClient,
        settings: NostrPublisherSettings,
        metrics: MetricsClient | None = None,
    ) -> None:
        self._client = client
        self._settings = settings
        self._metrics = metrics or get_metrics_client()

    def publish_release_note(
        self,
        *,
        session: Session,
        game: Game,
        reference: datetime | None = None,
    ) -> PublishOutcome:
        """Publish a release note event for the supplied game to configured relays."""

        overall_start = perf_counter()
        now = reference or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        else:
            now = now.astimezone(timezone.utc)

        event = self._build_event(game=game, created_at=now)
        payload_json = json.dumps(event, ensure_ascii=False, separators=(",", ":"))

        successes: list[str] = []
        failures: list[str] = []

        for relay_url in self._settings.relays:
            relay_start = perf_counter()
            queue_entry = self._load_queue_entry(
                session=session, game_id=game.id, relay_url=relay_url
            )
            if queue_entry is not None:
                queue_entry.payload = payload_json
                next_attempt_at = queue_entry.next_attempt_at
                if (
                    next_attempt_at is not None
                    and next_attempt_at.tzinfo is not None
                    and next_attempt_at > now
                ) or (
                    next_attempt_at is not None
                    and next_attempt_at.tzinfo is None
                    and next_attempt_at.replace(tzinfo=timezone.utc) > now
                ):
                    failures.append(relay_url)
                    self._metrics.increment(
                        "nostr.publisher.relay.skipped",
                        tags={"relay": relay_url, "reason": "backoff"},
                    )
                    self._metrics.observe(
                        "nostr.publisher.relay.latency_ms",
                        value=(perf_counter() - relay_start) * 1000.0,
                        tags={"relay": relay_url, "status": "skipped"},
                    )
                    logger.warning(
                        "relay.skip.backoff",
                        extra={
                            "relay_url": relay_url,
                            "game_id": game.id,
                            "next_attempt_at": next_attempt_at.isoformat()
                            if next_attempt_at
                            else None,
                        },
                    )
                    continue

            try:
                self._send_event(relay_url=relay_url, event=event)
            except RelayPublishError as exc:
                self._record_failure(
                    session=session,
                    game=game,
                    relay_url=relay_url,
                    existing_entry=queue_entry,
                    payload_json=payload_json,
                    failure_time=now,
                    error_message=str(exc),
                )
                failures.append(relay_url)
                self._metrics.increment(
                    "nostr.publisher.relay.failures",
                    tags={"relay": relay_url},
                )
                self._metrics.observe(
                    "nostr.publisher.relay.latency_ms",
                    value=(perf_counter() - relay_start) * 1000.0,
                    tags={"relay": relay_url, "status": "error"},
                )
                logger.warning(
                    "relay.publish.failed",
                    extra={
                        "relay_url": relay_url,
                        "game_id": game.id,
                        "error": str(exc),
                    },
                )
            else:
                successes.append(relay_url)
                elapsed_ms = (perf_counter() - relay_start) * 1000.0
                self._metrics.increment(
                    "nostr.publisher.relay.success",
                    tags={"relay": relay_url},
                )
                self._metrics.observe(
                    "nostr.publisher.relay.latency_ms",
                    value=elapsed_ms,
                    tags={"relay": relay_url, "status": "success"},
                )
                if queue_entry is not None:
                    session.delete(queue_entry)

        game.release_note_event_id = event["id"]
        game.release_note_published_at = now
        session.flush()

        outcome_status = "success"
        if failures and successes:
            outcome_status = "partial"
        elif failures and not successes:
            outcome_status = "failed"

        total_elapsed_ms = (perf_counter() - overall_start) * 1000.0
        self._metrics.increment(
            "nostr.publisher.publish.attempts", tags={"status": outcome_status}
        )
        self._metrics.observe(
            "nostr.publisher.publish.latency_ms",
            value=total_elapsed_ms,
            tags={"status": outcome_status},
        )

        queue_depth = session.execute(
            select(func.count()).select_from(ReleaseNotePublishQueue)
        ).scalar_one()
        self._metrics.gauge(
            "nostr.publisher.queue.backlog", value=float(queue_depth)
        )
        if queue_depth >= PUBLISH_QUEUE_ALERT_THRESHOLD:
            logger.warning(
                "relay.publish.backlog_high",
                extra={
                    "game_id": game.id,
                    "queue_depth": queue_depth,
                    "threshold": PUBLISH_QUEUE_ALERT_THRESHOLD,
                },
            )

        return PublishOutcome(
            event=event,
            successful_relays=tuple(successes),
            failed_relays=tuple(failures),
        )

    def _build_event(self, *, game: Game, created_at: datetime) -> dict[str, Any]:
        """Compose and sign a Nostr event describing the game's release."""

        timestamp = int(created_at.timestamp())
        tags = self._build_tags(game=game, created_at=created_at)
        event = {
            "pubkey": self._settings.platform_pubkey,
            "created_at": timestamp,
            "kind": NOSTR_KIND_RELEASE_NOTE,
            "tags": tags,
            "content": game.description_md or "",
        }
        event_id = calculate_event_id(**event)
        signature = schnorr_sign(bytes.fromhex(event_id), self._settings.private_key)
        event["id"] = event_id
        event["sig"] = signature.hex()
        return event

    def _build_tags(self, *, game: Game, created_at: datetime) -> list[list[str]]:
        """Return the standard tag set for release note events."""

        tags: list[list[str]] = [["d", f"game:{game.id}"], ["title", game.title]]
        summary = (game.summary or "").strip()
        if summary:
            tags.append(["summary", summary])
        if game.cover_url:
            tags.append(["image", game.cover_url])
        tags.append(["r", self._compose_game_url(game)])
        tags.append(["published_at", created_at.isoformat()])
        tags.append(["client", "proof-of-play-api"])
        tags.append(["t", "proof-of-play"])
        lnurl = self._settings.platform_lnurl
        if lnurl:
            tags.append(["lnurl", lnurl])
            tags.append(["zap", lnurl])
        return tags

    def _compose_game_url(self, game: Game) -> str:
        """Return the canonical storefront URL for the supplied game."""

        return f"{self._settings.public_web_url}/games/{game.slug}"

    def _load_queue_entry(
        self, *, session: Session, game_id: str, relay_url: str
    ) -> ReleaseNotePublishQueue | None:
        """Return an existing queue entry for the relay when present."""

        stmt = select(ReleaseNotePublishQueue).where(
            ReleaseNotePublishQueue.game_id == game_id,
            ReleaseNotePublishQueue.relay_url == relay_url,
        )
        return session.scalar(stmt)

    def _send_event(self, *, relay_url: str, event: Mapping[str, Any]) -> None:
        """Send the event payload to the target relay using the configured client."""

        try:
            response = self._client.post(
                relay_url, json=event, timeout=self._settings.request_timeout
            )
        except Exception as exc:  # pragma: no cover - defensive
            msg = f"Relay {relay_url} request failed: {exc}".strip()
            raise RelayPublishError(msg) from exc

        if response.status_code >= 400:
            msg = (
                f"Relay {relay_url} responded with status "
                f"{response.status_code}: {response.text.strip()}"
            )
            raise RelayPublishError(msg)

    def _record_failure(
        self,
        *,
        session: Session,
        game: Game,
        relay_url: str,
        existing_entry: ReleaseNotePublishQueue | None,
        payload_json: str,
        failure_time: datetime,
        error_message: str,
    ) -> None:
        """Persist backoff metadata so the relay can be retried later."""

        backoff = self._calculate_backoff_seconds(
            attempts=(existing_entry.attempts + 1) if existing_entry else 1
        )
        next_attempt = failure_time + timedelta(seconds=backoff)

        if existing_entry is None:
            entry = ReleaseNotePublishQueue(
                game_id=game.id,
                relay_url=relay_url,
                payload=payload_json,
                attempts=1,
                last_error=error_message,
                next_attempt_at=next_attempt,
            )
            session.add(entry)
        else:
            existing_entry.attempts = int(existing_entry.attempts or 0) + 1
            existing_entry.payload = payload_json
            existing_entry.last_error = error_message
            existing_entry.next_attempt_at = next_attempt

    def _calculate_backoff_seconds(self, *, attempts: int) -> int:
        """Return the number of seconds to wait before retrying a relay."""

        base = self._settings.backoff_seconds
        cap = self._settings.backoff_cap_seconds
        if attempts >= self._settings.circuit_breaker_attempts:
            return cap
        exponent = max(0, attempts - 1)
        delay = base * (2**exponent)
        return min(delay, cap)


@lru_cache(maxsize=1)
def get_release_note_publisher() -> ReleaseNotePublisher:
    """Return a cached release note publisher configured from settings."""

    settings = get_nostr_publisher_settings()
    return ReleaseNotePublisher(client=httpx, settings=settings)


def reset_release_note_publisher() -> None:
    """Clear the cached release note publisher. Intended for tests."""

    get_release_note_publisher.cache_clear()
