"""Tests for the release note Nostr publisher service."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import uuid

import httpx
import pytest
from sqlalchemy import select

from proof_of_play_api.core.config import NostrPublisherSettings
from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    Developer,
    Game,
    GameStatus,
    ReleaseNotePublishQueue,
    User,
)
from proof_of_play_api.services.nostr import derive_xonly_public_key, verify_signed_event
from proof_of_play_api.services.nostr_publisher import (
    ReleaseNotePublisher,
)


class _CapturingMetrics:
    """Fake metrics backend capturing emitted values for assertions."""

    def __init__(self) -> None:
        self.counters: list[tuple[str, int, dict[str, str]]] = []
        self.gauges: list[tuple[str, float, dict[str, str]]] = []
        self.observations: list[tuple[str, float, dict[str, str]]] = []

    def increment(
        self,
        metric: str,
        *,
        value: int = 1,
        tags: dict[str, str] | None = None,
    ) -> None:
        self.counters.append((metric, value, dict(tags or {})))

    def gauge(
        self,
        metric: str,
        *,
        value: float,
        tags: dict[str, str] | None = None,
    ) -> None:
        self.gauges.append((metric, float(value), dict(tags or {})))

    def observe(
        self,
        metric: str,
        *,
        value: float,
        tags: dict[str, str] | None = None,
    ) -> None:
        self.observations.append((metric, float(value), dict(tags or {})))


class _PerfCounterStub:
    """Deterministic stand-in for ``time.perf_counter`` during tests."""

    def __init__(self) -> None:
        self._value = 0.0

    def __call__(self) -> float:
        self._value += 1.0
        return self._value


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure each test runs against a fresh in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create ORM tables within the temporary SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _seed_game(session) -> Game:
    """Persist a developer and associated game for testing."""

    user = User(pubkey_hex=f"dev-{uuid.uuid4().hex}")
    session.add(user)
    session.flush()

    developer = Developer(user_id=user.id)
    session.add(developer)
    session.flush()

    game = Game(
        developer_id=developer.id,
        title="Signal Racer",
        slug=f"signal-racer-{uuid.uuid4().hex[:8]}",
        summary="Drift through interstellar traffic.",
        description_md="Face the grid with precision driving and speed.",
        status=GameStatus.UNLISTED,
        active=True,
    )
    session.add(game)
    session.flush()
    session.refresh(game)
    return game


def _build_settings(secret_key: int, *, relays: tuple[str, ...]) -> NostrPublisherSettings:
    """Return publisher settings suitable for tests."""

    pubkey = derive_xonly_public_key(secret_key).hex()
    return NostrPublisherSettings(
        relays=relays,
        platform_pubkey=pubkey,
        private_key=secret_key,
        public_web_url="https://games.example.com",
        platform_lnurl="lnurl1example",
        request_timeout=2.0,
        backoff_seconds=5,
        backoff_cap_seconds=120,
        circuit_breaker_attempts=3,
    )


def test_publish_release_note_successful_to_all_relays() -> None:
    """Successful publication should sign the event and contact every relay."""

    _create_schema()
    secret_key = 123456789
    settings = _build_settings(secret_key, relays=("https://relay.one/publish", "https://relay.two/publish"))
    captured: list[tuple[str, dict[str, object]]] = []

    def _handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content.decode("utf-8"))
        captured.append((str(request.url), payload))
        return httpx.Response(202, json={"accepted": True})

    transport = httpx.MockTransport(_handler)
    with httpx.Client(transport=transport) as client, session_scope() as session:
        game = _seed_game(session)
        publisher = ReleaseNotePublisher(client=client, settings=settings)
        reference = datetime(2024, 7, 1, 12, 0, tzinfo=timezone.utc)

        outcome = publisher.publish_release_note(session=session, game=game, reference=reference)

        entries = session.scalars(select(ReleaseNotePublishQueue)).all()
        assert entries == [], [entry.last_error for entry in entries]
        assert outcome.successful_relays == settings.relays, outcome
        assert outcome.failed_relays == tuple()
        session.refresh(game)
        assert game.release_note_event_id is not None
        stored_timestamp = game.release_note_published_at
        assert stored_timestamp is not None
        if stored_timestamp.tzinfo is None:
            assert stored_timestamp == reference.replace(tzinfo=None)
        else:
            assert stored_timestamp == reference

        event = outcome.event
        namespace = SimpleNamespace(**event)
        verify_signed_event(namespace)

        assert len(captured) == 2
        for relay, payload in captured:
            assert relay in settings.relays
            assert payload["id"] == event["id"]
            assert payload["kind"] == 30023
            assert any(tag[0] == "zap" for tag in payload["tags"])

        queue_entries = session.scalars(select(ReleaseNotePublishQueue)).all()
        assert queue_entries == []


def test_publish_release_note_records_failures_for_retry() -> None:
    """Failed relays should be recorded with backoff metadata."""

    _create_schema()
    secret_key = 987654321
    settings = _build_settings(secret_key, relays=("https://relay.fail/publish", "https://relay.ok/publish"))
    attempts: dict[str, int] = {"https://relay.fail/publish": 0, "https://relay.ok/publish": 0}

    def _handler(request: httpx.Request) -> httpx.Response:
        attempts[str(request.url)] += 1
        if str(request.url).endswith("fail/publish"):
            return httpx.Response(503, text="relay overloaded")
        return httpx.Response(200, json={"status": "ok"})

    transport = httpx.MockTransport(_handler)
    with httpx.Client(transport=transport) as client, session_scope() as session:
        game = _seed_game(session)
        publisher = ReleaseNotePublisher(client=client, settings=settings)
        reference = datetime(2024, 7, 2, 9, 30, tzinfo=timezone.utc)

        outcome = publisher.publish_release_note(session=session, game=game, reference=reference)

        assert outcome.successful_relays == ("https://relay.ok/publish",)
        assert outcome.failed_relays == ("https://relay.fail/publish",)

        session.refresh(game)
        assert game.release_note_event_id is not None
        stored_timestamp = game.release_note_published_at
        assert stored_timestamp is not None
        if stored_timestamp.tzinfo is None:
            assert stored_timestamp == reference.replace(tzinfo=None)
        else:
            assert stored_timestamp == reference

        queue_entry = session.scalar(
            select(ReleaseNotePublishQueue).where(
                ReleaseNotePublishQueue.relay_url == "https://relay.fail/publish"
            )
        )
        assert queue_entry is not None
        assert queue_entry.attempts == 1
        assert queue_entry.payload
        assert queue_entry.next_attempt_at is not None
        next_retry = queue_entry.next_attempt_at
        if next_retry.tzinfo is None:
            assert next_retry > reference.replace(tzinfo=None)
        else:
            assert next_retry > reference


def test_publish_release_note_skips_relays_during_backoff() -> None:
    """Relays with open circuits should not receive additional requests immediately."""

    _create_schema()
    secret_key = 43219876
    relays = ("https://relay.blocked/publish", "https://relay.active/publish")
    settings = _build_settings(secret_key, relays=relays)

    def _handler(request: httpx.Request) -> httpx.Response:
        if str(request.url).endswith("blocked/publish"):
            raise AssertionError("Blocked relay should not be contacted")
        return httpx.Response(200, json={"status": "ok"})

    transport = httpx.MockTransport(_handler)
    with httpx.Client(transport=transport) as client, session_scope() as session:
        game = _seed_game(session)
        blocked_entry = ReleaseNotePublishQueue(
            game_id=game.id,
            relay_url="https://relay.blocked/publish",
            payload="{}",
            attempts=settings.circuit_breaker_attempts,
            next_attempt_at=datetime(2024, 7, 3, 10, 0, tzinfo=timezone.utc) + timedelta(minutes=30),
        )
        session.add(blocked_entry)
        session.flush()

        publisher = ReleaseNotePublisher(client=client, settings=settings)
        reference = datetime(2024, 7, 3, 10, 0, tzinfo=timezone.utc)

        outcome = publisher.publish_release_note(session=session, game=game, reference=reference)

        assert outcome.successful_relays == ("https://relay.active/publish",)
        assert outcome.failed_relays == ("https://relay.blocked/publish",)

        updated_entry = session.scalar(
            select(ReleaseNotePublishQueue).where(
                ReleaseNotePublishQueue.relay_url == "https://relay.blocked/publish"
            )
        )
        assert updated_entry is not None
        assert updated_entry.attempts == settings.circuit_breaker_attempts
        assert updated_entry.payload != "{}"
        assert updated_entry.next_attempt_at == blocked_entry.next_attempt_at


def test_publish_release_note_emits_metrics(monkeypatch: pytest.MonkeyPatch) -> None:
    """Publishing should emit instrumentation for skips, failures, and successes."""

    _create_schema()
    secret_key = 192837465
    relays = (
        "https://relay.skip/publish",
        "https://relay.fail/publish",
        "https://relay.ok/publish",
    )
    settings = _build_settings(secret_key, relays=relays)
    metrics = _CapturingMetrics()
    perf_stub = _PerfCounterStub()
    monkeypatch.setattr(
        "proof_of_play_api.services.nostr_publisher.perf_counter", perf_stub
    )

    def _handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url.endswith("fail/publish"):
            return httpx.Response(502, text="relay unavailable")
        return httpx.Response(202, json={"accepted": True})

    transport = httpx.MockTransport(_handler)
    with httpx.Client(transport=transport) as client, session_scope() as session:
        game = _seed_game(session)
        blocked_entry = ReleaseNotePublishQueue(
            game_id=game.id,
            relay_url="https://relay.skip/publish",
            payload="{}",
            attempts=2,
            next_attempt_at=datetime(2024, 7, 4, 15, 0, tzinfo=timezone.utc)
            + timedelta(hours=1),
        )
        session.add(blocked_entry)
        session.flush()

        publisher = ReleaseNotePublisher(
            client=client, settings=settings, metrics=metrics
        )
        reference = datetime(2024, 7, 4, 15, 0, tzinfo=timezone.utc)

        outcome = publisher.publish_release_note(
            session=session, game=game, reference=reference
        )

        assert outcome.successful_relays == ("https://relay.ok/publish",)
        assert outcome.failed_relays == (
            "https://relay.skip/publish",
            "https://relay.fail/publish",
        )

        counter_index = {metric: tags for metric, _, tags in metrics.counters}
        assert counter_index["nostr.publisher.relay.skipped"] == {
            "relay": "https://relay.skip/publish",
            "reason": "backoff",
        }
        assert counter_index["nostr.publisher.relay.failures"] == {
            "relay": "https://relay.fail/publish",
        }
        assert counter_index["nostr.publisher.relay.success"] == {
            "relay": "https://relay.ok/publish",
        }

        publish_attempt_tags = [
            tags
            for metric, _, tags in metrics.counters
            if metric == "nostr.publisher.publish.attempts"
        ]
        assert publish_attempt_tags == [{"status": "partial"}]

        relay_statuses = {
            tags.get("status")
            for metric, _, tags in metrics.observations
            if metric == "nostr.publisher.relay.latency_ms"
        }
        assert relay_statuses == {"skipped", "error", "success"}

        publish_latency_tags = [
            tags
            for metric, _, tags in metrics.observations
            if metric == "nostr.publisher.publish.latency_ms"
        ]
        assert publish_latency_tags == [{"status": "partial"}]

        assert metrics.gauges == [
            ("nostr.publisher.queue.backlog", 2.0, {})
        ]
