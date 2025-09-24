"""Background worker that ingests release note replies from configured relays."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from time import perf_counter
from typing import Any, Mapping, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

import httpx

from bit_indie_api.core.config import (
    NostrIngestorSettings,
    get_nostr_ingestor_settings,
)
from bit_indie_api.core.metrics import MetricsClient, get_metrics_client
from bit_indie_api.db.models import (
    ReleaseNoteRelayCheckpoint,
    ReleaseNoteReply,
)
from bit_indie_api.services.release_note_moderation import evaluate_reply_moderation


INGESTION_BACKLOG_ALERT_THRESHOLD = 100


logger = logging.getLogger(__name__)


class RelayIngestionError(RuntimeError):
    """Base error raised when relay replies cannot be ingested."""


class RelayQueryError(RelayIngestionError):
    """Raised when a relay responds with an error status or malformed payload."""


class RelayEventParseError(RelayIngestionError):
    """Raised when a relay event payload is missing required data."""


class ReleaseNoteIngestionQueue(Protocol):
    """Protocol describing the queue used to distribute ingestion work."""

    def dequeue(self, *, shard_id: int, total_shards: int) -> "ReleaseNoteIngestionJob | None":
        """Return the next job for the provided shard, if any are available."""

    def acknowledge(self, job_id: str) -> None:
        """Mark the supplied job as processed."""

    def record_failure(self, job_id: str, *, reason: str) -> None:
        """Record that the supplied job failed so it can be retried."""


class _RelayClient(Protocol):
    """Subset of HTTP client behaviour used to query relays."""

    def post(self, url: str, *, json: Any, timeout: float) -> httpx.Response:
        """Perform an HTTP POST returning the raw response."""


@dataclass(frozen=True)
class ReleaseNoteIngestionJob:
    """Work item describing which release note event should be queried for replies."""

    job_id: str
    game_id: str
    release_note_event_id: str
    published_at: datetime
    popularity_score: float = 0.0

    def normalized_timestamp(self) -> int:
        """Return the published timestamp as an integer UTC epoch."""

        published = self.published_at
        if published.tzinfo is None:
            published = published.replace(tzinfo=timezone.utc)
        else:
            published = published.astimezone(timezone.utc)
        return int(published.timestamp())


@dataclass(frozen=True)
class _ParsedRelayEvent:
    """In-memory representation of a reply fetched from a relay."""

    event_id: str
    pubkey: str
    created_at: int
    kind: int
    content: str
    tags: list[list[str]]


class ReleaseNoteReplyIngestor:
    """Fetch replies for published release notes and persist them in the database."""

    def __init__(
        self,
        *,
        client: _RelayClient,
        queue: ReleaseNoteIngestionQueue,
        metrics: MetricsClient | None = None,
        settings: NostrIngestorSettings,
    ) -> None:
        self._client = client
        self._queue = queue
        self._metrics = metrics or get_metrics_client()
        self._settings = settings

    def process_next(
        self,
        *,
        session: Session,
        shard_id: int = 0,
        total_shards: int = 1,
    ) -> bool:
        """Pull a job from the queue and ingest replies for its release note."""

        if total_shards < 1:
            msg = "total_shards must be at least 1"
            raise ValueError(msg)
        if shard_id < 0 or shard_id >= total_shards:
            msg = "shard_id must be within [0, total_shards)"
            raise ValueError(msg)

        self._record_backlog_depth()
        job = self._queue.dequeue(shard_id=shard_id, total_shards=total_shards)
        if job is None:
            return False

        any_success = False
        for relay_url in self._settings.relays:
            relay_start = perf_counter()
            try:
                self._ingest_from_relay(
                    session=session,
                    job=job,
                    relay_url=relay_url,
                )
            except RelayQueryError as exc:
                self._metrics.increment(
                    "nostr.replies.ingestion.failures",
                    tags={"relay": relay_url, "reason": "query"},
                )
                self._metrics.increment(
                    "nostr.replies.ingestion.relay_failures",
                    tags={"relay": relay_url},
                )
                self._metrics.observe(
                    "nostr.replies.ingestion.relay_latency_ms",
                    value=(perf_counter() - relay_start) * 1000.0,
                    tags={"relay": relay_url, "status": "error"},
                )
                logger.warning(
                    "release_note_ingest.relay_failed",
                    extra={
                        "relay_url": relay_url,
                        "job_id": job.job_id,
                        "error": str(exc),
                    },
                )
            else:
                any_success = True
                elapsed_ms = (perf_counter() - relay_start) * 1000.0
                self._metrics.increment(
                    "nostr.replies.ingestion.relay_success",
                    tags={"relay": relay_url},
                )
                self._metrics.observe(
                    "nostr.replies.ingestion.relay_latency_ms",
                    value=elapsed_ms,
                    tags={"relay": relay_url, "status": "success"},
                )

        if any_success:
            self._queue.acknowledge(job.job_id)
        else:
            self._queue.record_failure(job.job_id, reason="all-relays-failed")
        return True

    def _record_backlog_depth(self) -> None:
        """Record metrics describing the current ingestion backlog when possible."""

        approx_callable = getattr(self._queue, "approx_size", None)
        if not callable(approx_callable):
            return

        try:
            depth = approx_callable()
        except Exception as exc:  # pragma: no cover - defensive logging path
            logger.warning(
                "release_note_ingest.backlog_probe_failed",
                extra={"error": str(exc)},
            )
            return

        if depth is None:
            return

        self._metrics.gauge(
            "nostr.replies.ingestion.backlog",
            value=float(depth),
        )
        if depth >= INGESTION_BACKLOG_ALERT_THRESHOLD:
            logger.warning(
                "release_note_ingest.backlog_high",
                extra={
                    "depth": depth,
                    "threshold": INGESTION_BACKLOG_ALERT_THRESHOLD,
                },
            )

    def _ingest_from_relay(
        self,
        *,
        session: Session,
        job: ReleaseNoteIngestionJob,
        relay_url: str,
    ) -> None:
        """Fetch replies from a single relay and persist new events."""

        checkpoint = self._load_checkpoint(session=session, relay_url=relay_url)
        since_timestamp = self._determine_since(job=job, checkpoint=checkpoint)
        payload = {
            "event_id": job.release_note_event_id,
            "since": since_timestamp,
            "limit": self._settings.batch_limit,
        }

        try:
            response = self._client.post(
                relay_url,
                json=payload,
                timeout=self._settings.request_timeout,
            )
        except httpx.HTTPError as exc:
            msg = f"Relay {relay_url} request failed: {exc}"
            raise RelayQueryError(msg) from exc
        if response.status_code >= 400:
            msg = (
                f"Relay {relay_url} responded with status "
                f"{response.status_code}: {response.text.strip()}"
            )
            raise RelayQueryError(msg)

        try:
            events_payload = response.json()
        except json.JSONDecodeError as exc:
            msg = f"Relay {relay_url} returned invalid JSON payload"
            raise RelayQueryError(msg) from exc

        if not isinstance(events_payload, list):
            msg = f"Relay {relay_url} returned a non-list payload"
            raise RelayQueryError(msg)

        max_created_at = checkpoint.last_event_created_at if checkpoint else None
        max_event_id = checkpoint.last_event_id if checkpoint else None

        for raw_event in events_payload:
            try:
                parsed = self._parse_event(raw_event, job=job)
            except RelayEventParseError:
                self._metrics.increment(
                    "nostr.replies.ingestion.failures",
                    tags={"relay": relay_url, "reason": "parse"},
                )
                continue

            stored = self._store_reply(
                session=session,
                job=job,
                relay_url=relay_url,
                parsed=parsed,
            )
            if not stored:
                continue

            created_at = parsed.created_at
            if (max_created_at is None) or (created_at > max_created_at):
                max_created_at = created_at
                max_event_id = parsed.event_id
            elif created_at == max_created_at and parsed.event_id > (max_event_id or ""):
                max_event_id = parsed.event_id

        if max_created_at is not None:
            self._update_checkpoint(
                session=session,
                checkpoint=checkpoint,
                relay_url=relay_url,
                created_at=max_created_at,
                event_id=max_event_id,
            )

    def _load_checkpoint(
        self,
        *,
        session: Session,
        relay_url: str,
    ) -> ReleaseNoteRelayCheckpoint | None:
        """Return the existing checkpoint for the supplied relay when present."""

        stmt = select(ReleaseNoteRelayCheckpoint).where(
            ReleaseNoteRelayCheckpoint.relay_url == relay_url
        )
        return session.scalar(stmt)

    def _determine_since(
        self,
        *,
        job: ReleaseNoteIngestionJob,
        checkpoint: ReleaseNoteRelayCheckpoint | None,
    ) -> int:
        """Determine the timestamp to include in the relay query."""

        if checkpoint and checkpoint.last_event_created_at is not None:
            return int(checkpoint.last_event_created_at)

        published_ts = job.normalized_timestamp()
        lookback = self._settings.lookback_seconds
        if lookback <= 0:
            return published_ts
        threshold = published_ts - lookback
        return threshold if threshold > 0 else 0

    def _parse_event(
        self,
        raw_event: object,
        *,
        job: ReleaseNoteIngestionJob,
    ) -> _ParsedRelayEvent:
        """Validate and normalise raw relay event payloads."""

        if not isinstance(raw_event, Mapping):
            msg = "Relay event payload must be a JSON object"
            raise RelayEventParseError(msg)

        try:
            event_id = str(raw_event["id"])
            pubkey = str(raw_event["pubkey"])
            created_at_raw = raw_event["created_at"]
            kind_raw = raw_event["kind"]
            content = str(raw_event.get("content", ""))
            tags = raw_event.get("tags", [])
        except KeyError as exc:  # pragma: no cover - defensive guard
            msg = f"Missing event field: {exc.args[0]}"
            raise RelayEventParseError(msg) from exc

        try:
            created_at = int(created_at_raw)
        except (TypeError, ValueError) as exc:
            msg = "Event created_at must be an integer timestamp"
            raise RelayEventParseError(msg) from exc

        try:
            kind = int(kind_raw)
        except (TypeError, ValueError) as exc:
            msg = "Event kind must be an integer"
            raise RelayEventParseError(msg) from exc

        if not isinstance(tags, list):
            msg = "Event tags must be provided as a list"
            raise RelayEventParseError(msg)

        normalised_tags: list[list[str]] = []
        references_release_note = False
        for tag in tags:
            if not isinstance(tag, list) or not tag:
                continue
            if not all(isinstance(value, str) for value in tag):
                continue
            normalised_tags.append([value for value in tag])
            if len(tag) >= 2 and tag[0] == "e" and tag[1] == job.release_note_event_id:
                references_release_note = True

        if not references_release_note:
            msg = "Event does not reference the target release note"
            raise RelayEventParseError(msg)

        return _ParsedRelayEvent(
            event_id=event_id,
            pubkey=pubkey,
            created_at=created_at,
            kind=kind,
            content=content,
            tags=normalised_tags,
        )

    def _store_reply(
        self,
        *,
        session: Session,
        job: ReleaseNoteIngestionJob,
        relay_url: str,
        parsed: _ParsedRelayEvent,
    ) -> bool:
        """Persist a parsed relay event unless it already exists."""

        stmt = select(ReleaseNoteReply).where(
            ReleaseNoteReply.game_id == job.game_id,
            ReleaseNoteReply.event_id == parsed.event_id,
        )
        existing = session.scalar(stmt)
        if existing is not None:
            return False

        event_timestamp = datetime.fromtimestamp(parsed.created_at, tz=timezone.utc)
        decision = evaluate_reply_moderation(parsed.content)
        hidden_at = datetime.now(timezone.utc) if decision.is_hidden else None
        reply = ReleaseNoteReply(
            game_id=job.game_id,
            release_note_event_id=job.release_note_event_id,
            relay_url=relay_url,
            event_id=parsed.event_id,
            pubkey=parsed.pubkey,
            kind=parsed.kind,
            event_created_at=event_timestamp,
            content=parsed.content,
            tags_json=json.dumps(parsed.tags, ensure_ascii=False, separators=(",", ":")),
            is_hidden=decision.is_hidden,
            hidden_reason=decision.reason,
            moderation_notes=decision.notes,
            hidden_at=hidden_at,
        )
        session.add(reply)
        session.flush()
        return True

    def _update_checkpoint(
        self,
        *,
        session: Session,
        checkpoint: ReleaseNoteRelayCheckpoint | None,
        relay_url: str,
        created_at: int,
        event_id: str | None,
    ) -> None:
        """Persist the latest event metadata for the relay checkpoint."""

        if checkpoint is None:
            checkpoint = ReleaseNoteRelayCheckpoint(
                relay_url=relay_url,
                last_event_created_at=int(created_at),
                last_event_id=event_id,
            )
            session.add(checkpoint)
        else:
            checkpoint.last_event_created_at = int(created_at)
            checkpoint.last_event_id = event_id
        session.flush()


def build_release_note_reply_ingestor(
    *,
    queue: ReleaseNoteIngestionQueue,
    metrics: MetricsClient | None = None,
    client: _RelayClient | None = None,
    settings: NostrIngestorSettings | None = None,
) -> ReleaseNoteReplyIngestor:
    """Helper to construct an ingestor using configured defaults."""

    resolved_settings = settings or get_nostr_ingestor_settings()
    resolved_client = client or httpx
    return ReleaseNoteReplyIngestor(
        client=resolved_client,
        queue=queue,
        metrics=metrics,
        settings=resolved_settings,
    )
