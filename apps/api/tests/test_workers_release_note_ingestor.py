from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable

import httpx
import pytest
from sqlalchemy import select

from proof_of_play_api.core.config import NostrIngestorSettings
from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    Developer,
    Game,
    GameStatus,
    ReleaseNoteRelayCheckpoint,
    ReleaseNoteReply,
    User,
)
from proof_of_play_api.workers.release_note_ingestor import (
    ReleaseNoteIngestionJob,
    ReleaseNoteReplyIngestor,
)


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure each test runs against a pristine in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create ORM tables within the temporary SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _seed_game(session) -> Game:
    """Persist a developer, game, and release note metadata for tests."""

    user = User(pubkey_hex=f"dev-{uuid.uuid4().hex}")
    session.add(user)
    session.flush()

    developer = Developer(user_id=user.id)
    session.add(developer)
    session.flush()

    published_at = datetime(2024, 7, 1, 12, 0, tzinfo=timezone.utc)
    game = Game(
        developer_id=developer.id,
        title="Signal Racer",
        slug=f"signal-racer-{uuid.uuid4().hex[:8]}",
        summary="Drift through interstellar traffic.",
        description_md="Face the grid with precision driving and speed.",
        status=GameStatus.UNLISTED,
        active=True,
        release_note_event_id=f"note-{uuid.uuid4().hex}",
        release_note_published_at=published_at,
    )
    session.add(game)
    session.flush()
    session.refresh(game)
    return game


def _build_settings(*, relays: Iterable[str]) -> NostrIngestorSettings:
    """Return ingestion settings suitable for tests."""

    return NostrIngestorSettings(
        relays=tuple(relays),
        request_timeout=2.0,
        batch_limit=50,
        lookback_seconds=3600,
    )


@dataclass
class _FakeQueue:
    """Simple in-memory queue implementation for tests."""

    jobs: list[ReleaseNoteIngestionJob]
    acknowledged: list[str] = field(default_factory=list)
    failed: list[tuple[str, str]] = field(default_factory=list)
    last_request: tuple[int, int] | None = None

    def dequeue(self, *, shard_id: int, total_shards: int) -> ReleaseNoteIngestionJob | None:
        self.last_request = (shard_id, total_shards)
        if not self.jobs:
            return None
        return self.jobs.pop(0)

    def acknowledge(self, job_id: str) -> None:
        self.acknowledged.append(job_id)

    def record_failure(self, job_id: str, *, reason: str) -> None:
        self.failed.append((job_id, reason))


@dataclass
class _FakeMetrics:
    """In-memory metrics collector recording increments for assertions."""

    increments: list[tuple[str, dict[str, str] | None]] = field(default_factory=list)

    def increment(self, metric: str, *, tags: dict[str, str] | None = None) -> None:
        self.increments.append((metric, tags))


def test_ingestor_persists_replies_and_updates_checkpoint() -> None:
    """Successful ingestion should persist replies and advance relay checkpoints."""

    _create_schema()
    settings = _build_settings(relays=("https://relay.one/replies", "https://relay.two/replies"))
    metrics = _FakeMetrics()

    with session_scope() as session:
        game = _seed_game(session)
        job = ReleaseNoteIngestionJob(
            job_id="job-1",
            game_id=game.id,
            release_note_event_id=game.release_note_event_id or "",
            published_at=game.release_note_published_at or datetime.now(timezone.utc),
        )

    queue = _FakeQueue(jobs=[job])
    captured_requests: list[tuple[str, dict[str, object]]] = []

    def _handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content.decode("utf-8"))
        captured_requests.append((str(request.url), payload))
        if str(request.url).endswith("relay.one/replies"):
            events = [
                {
                    "id": "reply-1",
                    "pubkey": "a" * 64,
                    "created_at": int(datetime(2024, 7, 1, 12, 10, tzinfo=timezone.utc).timestamp()),
                    "kind": 1,
                    "content": "Congrats on the launch!",
                    "tags": [["e", job.release_note_event_id], ["p", "b" * 64]],
                }
            ]
        else:
            events = []
        return httpx.Response(200, json=events)

    transport = httpx.MockTransport(_handler)
    with httpx.Client(transport=transport) as client, session_scope() as session:
        worker = ReleaseNoteReplyIngestor(
            client=client,
            queue=queue,
            metrics=metrics,
            settings=settings,
        )

        processed = worker.process_next(session=session, shard_id=1, total_shards=2)
        assert processed is True

        replies = session.scalars(select(ReleaseNoteReply)).all()
        assert len(replies) == 1
        reply = replies[0]
        assert reply.event_id == "reply-1"
        assert reply.game_id == job.game_id
        assert reply.release_note_event_id == job.release_note_event_id
        assert reply.relay_url == "https://relay.one/replies"
        assert reply.pubkey == "a" * 64
        assert reply.kind == 1
        assert reply.content == "Congrats on the launch!"
        assert json.loads(reply.tags_json) == [["e", job.release_note_event_id], ["p", "b" * 64]]
        expected_created = datetime(2024, 7, 1, 12, 10, tzinfo=timezone.utc)
        if reply.event_created_at.tzinfo is None:
            assert reply.event_created_at == expected_created.replace(tzinfo=None)
        else:
            assert reply.event_created_at == expected_created

        checkpoint = session.scalar(
            select(ReleaseNoteRelayCheckpoint).where(
                ReleaseNoteRelayCheckpoint.relay_url == "https://relay.one/replies"
            )
        )
        assert checkpoint is not None
        assert checkpoint.last_event_created_at == int(reply.event_created_at.timestamp())
        assert checkpoint.last_event_id == "reply-1"

    assert queue.acknowledged == ["job-1"]
    assert queue.failed == []
    assert queue.last_request == (1, 2)
    assert metrics.increments == []

    assert len(captured_requests) == 2
    first_request = captured_requests[0]
    assert first_request[0] == "https://relay.one/replies"
    assert first_request[1]["event_id"] == job.release_note_event_id
    expected_since = int(job.published_at.timestamp()) - settings.lookback_seconds
    assert first_request[1]["since"] == expected_since
    assert first_request[1]["limit"] == settings.batch_limit


def test_ingestor_skips_invalid_events_and_records_metrics() -> None:
    """Events without the release note reference should be ignored and logged."""

    _create_schema()
    settings = _build_settings(relays=("https://relay.test/replies",))
    metrics = _FakeMetrics()

    with session_scope() as session:
        game = _seed_game(session)
        existing_reply = ReleaseNoteReply(
            game_id=game.id,
            release_note_event_id=game.release_note_event_id or "",
            relay_url="https://relay.test/replies",
            event_id="reply-existing",
            pubkey="c" * 64,
            kind=1,
            event_created_at=datetime(2024, 7, 1, 12, 5, tzinfo=timezone.utc),
            content="Already stored",
            tags_json=json.dumps([["e", game.release_note_event_id]], separators=(",", ":")),
        )
        session.add(existing_reply)
        session.flush()

        job = ReleaseNoteIngestionJob(
            job_id="job-parse",
            game_id=game.id,
            release_note_event_id=game.release_note_event_id or "",
            published_at=game.release_note_published_at or datetime.now(timezone.utc),
        )

    queue = _FakeQueue(jobs=[job])

    def _handler(request: httpx.Request) -> httpx.Response:
        events = [
            {
                "id": "reply-existing",
                "pubkey": "c" * 64,
                "created_at": int(datetime(2024, 7, 1, 12, 5, tzinfo=timezone.utc).timestamp()),
                "kind": 1,
                "content": "Already stored",
                "tags": [["e", job.release_note_event_id]],
            },
            {
                "id": "reply-missing-tag",
                "pubkey": "d" * 64,
                "created_at": int(datetime(2024, 7, 1, 12, 15, tzinfo=timezone.utc).timestamp()),
                "kind": 1,
                "content": "Where is the reference?",
                "tags": [["p", "d" * 64]],
            },
        ]
        return httpx.Response(200, json=events)

    transport = httpx.MockTransport(_handler)
    with httpx.Client(transport=transport) as client, session_scope() as session:
        worker = ReleaseNoteReplyIngestor(
            client=client,
            queue=queue,
            metrics=metrics,
            settings=settings,
        )

        processed = worker.process_next(session=session)
        assert processed is True

        replies = session.scalars(select(ReleaseNoteReply)).all()
        assert len(replies) == 1
        assert replies[0].event_id == "reply-existing"

    assert queue.acknowledged == ["job-parse"]
    assert queue.failed == []
    assert metrics.increments == [
        ("nostr.replies.ingestion.failures", {"relay": "https://relay.test/replies", "reason": "parse"})
    ]


def test_ingestor_records_failure_when_relays_fail() -> None:
    """If all relays fail the job should be marked for retry and metrics recorded."""

    _create_schema()
    settings = _build_settings(relays=("https://relay.one/replies", "https://relay.two/replies"))
    metrics = _FakeMetrics()

    with session_scope() as session:
        game = _seed_game(session)
        job = ReleaseNoteIngestionJob(
            job_id="job-fail",
            game_id=game.id,
            release_note_event_id=game.release_note_event_id or "",
            published_at=game.release_note_published_at or datetime.now(timezone.utc),
        )

    queue = _FakeQueue(jobs=[job])

    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="relay unavailable")

    transport = httpx.MockTransport(_handler)
    with httpx.Client(transport=transport) as client, session_scope() as session:
        worker = ReleaseNoteReplyIngestor(
            client=client,
            queue=queue,
            metrics=metrics,
            settings=settings,
        )

        processed = worker.process_next(session=session)
        assert processed is True

        replies = session.scalars(select(ReleaseNoteReply)).all()
        assert replies == []

    assert queue.acknowledged == []
    assert queue.failed == [("job-fail", "all-relays-failed")]
    assert metrics.increments == [
        ("nostr.replies.ingestion.failures", {"relay": "https://relay.one/replies", "reason": "query"}),
        ("nostr.replies.ingestion.failures", {"relay": "https://relay.two/replies", "reason": "query"}),
    ]


def test_ingestor_converts_http_errors_into_query_failures() -> None:
    """HTTP client errors should be treated as query failures for consistent handling."""

    _create_schema()
    settings = _build_settings(relays=("https://relay.down/replies",))
    metrics = _FakeMetrics()

    with session_scope() as session:
        game = _seed_game(session)
        job = ReleaseNoteIngestionJob(
            job_id="job-network",
            game_id=game.id,
            release_note_event_id=game.release_note_event_id or "",
            published_at=game.release_note_published_at or datetime.now(timezone.utc),
        )

    queue = _FakeQueue(jobs=[job])

    def _handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("network unreachable", request=request)

    transport = httpx.MockTransport(_handler)
    with httpx.Client(transport=transport) as client, session_scope() as session:
        worker = ReleaseNoteReplyIngestor(
            client=client,
            queue=queue,
            metrics=metrics,
            settings=settings,
        )

        processed = worker.process_next(session=session)
        assert processed is True

        replies = session.scalars(select(ReleaseNoteReply)).all()
        assert replies == []

    assert queue.acknowledged == []
    assert queue.failed == [("job-network", "all-relays-failed")]
    assert metrics.increments == [
        ("nostr.replies.ingestion.failures", {"relay": "https://relay.down/replies", "reason": "query"})
    ]


def test_process_next_validates_shard_arguments() -> None:
    """Invalid shard arguments should raise a clear error before queue access."""

    _create_schema()
    settings = _build_settings(relays=("https://relay.one/replies",))
    metrics = _FakeMetrics()
    queue = _FakeQueue(jobs=[])

    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=[]))) as client, session_scope() as session:
        worker = ReleaseNoteReplyIngestor(
            client=client,
            queue=queue,
            metrics=metrics,
            settings=settings,
        )

        with pytest.raises(ValueError):
            worker.process_next(session=session, total_shards=0)

        with pytest.raises(ValueError):
            worker.process_next(session=session, shard_id=-1)

        with pytest.raises(ValueError):
            worker.process_next(session=session, shard_id=5, total_shards=2)
