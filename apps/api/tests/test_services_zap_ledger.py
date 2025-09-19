from __future__ import annotations

from datetime import datetime, timezone
import logging
import types
import uuid

import pytest

from sqlalchemy import select

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    Developer,
    Game,
    GameStatus,
    User,
    ZapLedgerTotal,
    ZapSource,
    ZapTargetType,
)
from proof_of_play_api.services.nostr import calculate_event_id, derive_xonly_public_key, schnorr_sign
from proof_of_play_api.services.zap_ledger import ZapLedger, ZapLedgerParseError


@pytest.fixture(autouse=True)
def _reset_database(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure tests run against an isolated in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Instantiate ORM tables for tests."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _seed_game():
    """Persist a user, developer, and game for zap tests."""

    with session_scope() as session:
        user = User(pubkey_hex=f"user-{uuid.uuid4().hex}")
        session.add(user)
        session.flush()

        developer = Developer(user_id=user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Zap Rally",
            slug=f"zap-rally-{uuid.uuid4().hex[:8]}",
            status=GameStatus.DISCOVER,
            active=True,
        )
        session.add(game)
        session.flush()
        session.refresh(game)
        return types.SimpleNamespace(id=game.id, slug=game.slug, title=game.title)


def _build_event(secret_key: int, tags: list[list[str]], *, created_at: int | None = None):
    """Construct a signed Nostr event suitable for zap ledger ingestion."""

    pubkey_hex = derive_xonly_public_key(secret_key).hex()
    timestamp = created_at or int(datetime.now(tz=timezone.utc).timestamp())
    base_event = {
        "pubkey": pubkey_hex,
        "created_at": timestamp,
        "kind": 9735,
        "tags": tags,
        "content": "Zap receipt",
    }
    event_id = calculate_event_id(**base_event)
    signature = schnorr_sign(bytes.fromhex(event_id), secret_key)
    payload = {**base_event, "id": event_id, "sig": signature.hex()}
    return types.SimpleNamespace(**payload)


def test_record_event_updates_totals() -> None:
    """Zap ledger should aggregate totals for games and platform targets."""

    _create_schema()
    game = _seed_game()
    service = ZapLedger()

    tags = [
        ["proof-of-play-zap-target", "GAME", game.id, "125000", "DIRECT"],
        ["proof-of-play-zap-target", "PLATFORM", "", "5000", "FORWARDED"],
    ]
    event = _build_event(1337, tags)

    with session_scope() as session:
        ledger_event = service.record_event(session=session, event=event)
        session.refresh(ledger_event)

        assert ledger_event.total_msats == 130_000
        assert ledger_event.part_count == 2

        game_totals = session.scalars(
            select(ZapLedgerTotal)
            .where(ZapLedgerTotal.target_type == ZapTargetType.GAME)
            .where(ZapLedgerTotal.target_id == game.id)
        ).all()
        assert len(game_totals) == 1
        assert game_totals[0].total_msats == 125_000
        assert game_totals[0].zap_source == ZapSource.DIRECT
        assert game_totals[0].zap_count == 1

        platform_totals = session.scalars(
            select(ZapLedgerTotal)
            .where(ZapLedgerTotal.target_type == ZapTargetType.PLATFORM)
        ).all()
        assert len(platform_totals) == 1
        assert platform_totals[0].target_id == "platform"
        assert platform_totals[0].total_msats == 5_000
        assert platform_totals[0].zap_source == ZapSource.FORWARDED


def test_record_event_is_idempotent() -> None:
    """Processing the same zap ledger event twice should be a no-op."""

    _create_schema()
    game = _seed_game()
    service = ZapLedger()

    tags = [["proof-of-play-zap-target", "GAME", game.id, "32000"]]
    event = _build_event(4242, tags)

    with session_scope() as session:
        first = service.record_event(session=session, event=event)
        second = service.record_event(session=session, event=event)

        assert first.id == second.id
        totals = session.scalars(select(ZapLedgerTotal)).all()
        assert len(totals) == 1
        assert totals[0].total_msats == 32_000
        assert totals[0].zap_count == 1


def test_record_event_logs_parse_error(caplog: pytest.LogCaptureFixture) -> None:
    """Malformed zap events should emit telemetry-friendly warnings."""

    _create_schema()
    service = ZapLedger()
    caplog.set_level(logging.WARNING)

    malformed_event = _build_event(7777, [["proof-of-play-zap-target", "GAME"]])

    with session_scope() as session:
        with pytest.raises(ZapLedgerParseError):
            service.record_event(session=session, event=malformed_event)

    assert any(record.message == "zap_ledger_parse_error" for record in caplog.records)


def test_record_event_tracks_forwarded_source() -> None:
    """Zap ledger should persist source classification metadata."""

    _create_schema()
    game = _seed_game()
    service = ZapLedger()

    forwarded_tags = [["proof-of-play-zap-target", "GAME", game.id, "22000", "FORWARDED"]]
    forwarded_event = _build_event(9001, forwarded_tags)

    with session_scope() as session:
        service.record_event(session=session, event=forwarded_event)
        totals = session.scalars(select(ZapLedgerTotal)).all()
        assert len(totals) == 1
        assert totals[0].zap_source == ZapSource.FORWARDED

    direct_tags = [["proof-of-play-zap-target", "GAME", game.id, "8000"]]
    direct_event = _build_event(1338, direct_tags, created_at=int(datetime.now(tz=timezone.utc).timestamp()) + 60)

    with session_scope() as session:
        service.record_event(session=session, event=direct_event)
        rows = session.scalars(
            select(ZapLedgerTotal)
            .where(ZapLedgerTotal.target_type == ZapTargetType.GAME)
            .where(ZapLedgerTotal.target_id == game.id)
        ).all()
        sources = {row.zap_source: row.total_msats for row in rows}
        assert sources[ZapSource.FORWARDED] == 22_000
        assert sources[ZapSource.DIRECT] == 8_000
