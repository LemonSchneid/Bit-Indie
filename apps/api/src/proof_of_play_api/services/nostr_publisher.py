"""Publish release notes to Nostr relays when games go live."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from time import perf_counter
from typing import Any, Callable, Mapping, Protocol

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


@dataclass
class _RelayAttemptState:
    """Track metadata for a single relay publish attempt."""

    relay_url: str
    entry: ReleaseNotePublishQueue | None
    next_attempt_at: datetime | None
    skip_reason: str | None = None

    @property
    def should_skip(self) -> bool:
        """Return ``True`` when the relay should be skipped for this run."""

        return self.skip_reason is not None


class _RelayQueueManager:
    """Coordinate queue persistence and retry behaviour for relay attempts."""

    def __init__(
        self,
        *,
        session: Session,
        now: datetime,
        backoff_strategy: Callable[[int], int],
    ) -> None:
        self._session = session
        self._now = now
        self._backoff_strategy = backoff_strategy

    def prepare_attempt(
        self,
        *,
        game_id: str,
        relay_url: str,
        payload_json: str,
    ) -> _RelayAttemptState:
        """Load queue metadata and determine whether the relay is eligible."""

        entry = self._load_queue_entry(game_id=game_id, relay_url=relay_url)
        skip_reason: str | None = None
        next_attempt_at: datetime | None = None
        if entry is not None:
            entry.payload = payload_json
            next_attempt_at = entry.next_attempt_at
            normalized = self._normalize_timestamp(next_attempt_at)
            if normalized is not None and normalized > self._now:
                skip_reason = "backoff"
        return _RelayAttemptState(
            relay_url=relay_url,
            entry=entry,
            next_attempt_at=next_attempt_at,
            skip_reason=skip_reason,
        )

    def record_failure(
        self,
        *,
        game: Game,
        attempt: _RelayAttemptState,
        payload_json: str,
        error_message: str,
    ) -> None:
        """Persist retry metadata when a relay rejects the publish."""

        entry = attempt.entry
        attempts = int(entry.attempts or 0) + 1 if entry else 1
        backoff_seconds = self._backoff_strategy(attempts=attempts)
        next_attempt = self._now + timedelta(seconds=backoff_seconds)

        if entry is None:
            entry = ReleaseNotePublishQueue(
                game_id=game.id,
                relay_url=attempt.relay_url,
                payload=payload_json,
                attempts=attempts,
                last_error=error_message,
                next_attempt_at=next_attempt,
            )
            self._session.add(entry)
        else:
            entry.attempts = attempts
            entry.payload = payload_json
            entry.last_error = error_message
            entry.next_attempt_at = next_attempt

        attempt.entry = entry
        attempt.next_attempt_at = entry.next_attempt_at
        attempt.skip_reason = None

    def record_success(self, attempt: _RelayAttemptState) -> None:
        """Remove queue entries when a relay accepts the publish."""

        entry = attempt.entry
        if entry is not None:
            self._session.delete(entry)

    def record_backlog_metric(self, *, metrics: MetricsClient) -> int:
        """Emit queue backlog gauges and return the current depth."""

        queue_depth = self._session.execute(
            select(func.count()).select_from(ReleaseNotePublishQueue)
        ).scalar_one()
        metrics.gauge("nostr.publisher.queue.backlog", value=float(queue_depth))
        return int(queue_depth)

    def _load_queue_entry(
        self, *, game_id: str, relay_url: str
    ) -> ReleaseNotePublishQueue | None:
        stmt = select(ReleaseNotePublishQueue).where(
            ReleaseNotePublishQueue.game_id == game_id,
            ReleaseNotePublishQueue.relay_url == relay_url,
        )
        return self._session.scalar(stmt)

    @staticmethod
    def _normalize_timestamp(value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class _RelayInstrumentation:
    """Publish metrics describing relay outcomes and overall timing."""

    def __init__(self, *, metrics: MetricsClient) -> None:
        self._metrics = metrics

    def record_skip(self, *, relay_url: str, started_at: float, reason: str) -> None:
        """Emit skip counters and latency for relays currently in backoff."""

        elapsed_ms = (perf_counter() - started_at) * 1000.0
        self._metrics.increment(
            "nostr.publisher.relay.skipped",
            tags={"relay": relay_url, "reason": reason},
        )
        self._metrics.observe(
            "nostr.publisher.relay.latency_ms",
            value=elapsed_ms,
            tags={"relay": relay_url, "status": "skipped"},
        )

    def record_failure(self, *, relay_url: str, started_at: float) -> None:
        """Emit counters and latency for relays that returned errors."""

        elapsed_ms = (perf_counter() - started_at) * 1000.0
        self._metrics.increment(
            "nostr.publisher.relay.failures", tags={"relay": relay_url}
        )
        self._metrics.observe(
            "nostr.publisher.relay.latency_ms",
            value=elapsed_ms,
            tags={"relay": relay_url, "status": "error"},
        )

    def record_success(self, *, relay_url: str, started_at: float) -> None:
        """Emit counters and latency for relays that accepted the event."""

        elapsed_ms = (perf_counter() - started_at) * 1000.0
        self._metrics.increment(
            "nostr.publisher.relay.success", tags={"relay": relay_url}
        )
        self._metrics.observe(
            "nostr.publisher.relay.latency_ms",
            value=elapsed_ms,
            tags={"relay": relay_url, "status": "success"},
        )

    def record_attempt(self, *, status: str, started_at: float) -> None:
        """Emit metrics describing the overall publish attempt status."""

        elapsed_ms = (perf_counter() - started_at) * 1000.0
        self._metrics.increment(
            "nostr.publisher.publish.attempts", tags={"status": status}
        )
        self._metrics.observe(
            "nostr.publisher.publish.latency_ms",
            value=elapsed_ms,
            tags={"status": status},
        )


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

        queue_manager = _RelayQueueManager(
            session=session,
            now=now,
            backoff_strategy=self._calculate_backoff_seconds,
        )
        instrumentation = _RelayInstrumentation(metrics=self._metrics)

        for relay_url in self._settings.relays:
            relay_start = perf_counter()
            attempt = queue_manager.prepare_attempt(
                game_id=game.id, relay_url=relay_url, payload_json=payload_json
            )
            if attempt.should_skip:
                failures.append(relay_url)
                instrumentation.record_skip(
                    relay_url=relay_url,
                    started_at=relay_start,
                    reason=attempt.skip_reason or "backoff",
                )
                logger.warning(
                    "relay.skip.backoff",
                    extra={
                        "relay_url": relay_url,
                        "game_id": game.id,
                        "next_attempt_at": attempt.next_attempt_at.isoformat()
                        if attempt.next_attempt_at
                        else None,
                    },
                )
                continue

            try:
                self._send_event(relay_url=relay_url, event=event)
            except RelayPublishError as exc:
                queue_manager.record_failure(
                    game=game,
                    attempt=attempt,
                    payload_json=payload_json,
                    error_message=str(exc),
                )
                failures.append(relay_url)
                instrumentation.record_failure(
                    relay_url=relay_url, started_at=relay_start
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
                instrumentation.record_success(
                    relay_url=relay_url, started_at=relay_start
                )
                queue_manager.record_success(attempt)

        game.release_note_event_id = event["id"]
        game.release_note_published_at = now
        session.flush()

        outcome_status = "success"
        if failures and successes:
            outcome_status = "partial"
        elif failures and not successes:
            outcome_status = "failed"

        instrumentation.record_attempt(
            status=outcome_status, started_at=overall_start
        )

        queue_depth = queue_manager.record_backlog_metric(metrics=self._metrics)
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
