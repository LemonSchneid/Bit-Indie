from __future__ import annotations

from datetime import datetime, timezone
import types
import uuid

import pytest
from fastapi.testclient import TestClient

from proof_of_play_api.core.config import clear_nostr_publisher_settings_cache
from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import Developer, Game, GameStatus, User
from proof_of_play_api.main import create_application
from proof_of_play_api.services.nostr import calculate_event_id, derive_xonly_public_key, schnorr_sign
from proof_of_play_api.services.zap_ledger import ZapLedger


@pytest.fixture(autouse=True)
def _reset_database(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run tests against an isolated in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Instantiate ORM tables for tests."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _seed_game():
    """Persist a game with associated developer for zap testing."""

    with session_scope() as session:
        user = User(pubkey_hex=f"seed-{uuid.uuid4().hex}")
        session.add(user)
        session.flush()

        developer = Developer(user_id=user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Zap Quest",
            slug=f"zap-quest-{uuid.uuid4().hex[:8]}",
            status=GameStatus.DISCOVER,
            active=True,
        )
        session.add(game)
        session.flush()
        session.refresh(game)
        return types.SimpleNamespace(id=game.id, slug=game.slug, title=game.title)


def _build_event(secret_key: int, tags: list[list[str]], *, created_at: int | None = None):
    """Return a signed Nostr event for zap ledger ingestion."""

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


def test_zap_summary_endpoint_returns_totals(monkeypatch: pytest.MonkeyPatch) -> None:
    """The zap summary endpoint should expose aggregate and platform data."""

    monkeypatch.setenv("NOSTR_RELAYS", "wss://example-relay")
    monkeypatch.setenv("PLATFORM_PUBKEY", "ab" * 32)
    monkeypatch.setenv("PLATFORM_SIGNING_KEY_HEX", "cd" * 32)
    monkeypatch.setenv("PLATFORM_LNURL", "lnurl1proofofplay")
    clear_nostr_publisher_settings_cache()

    _create_schema()
    game = _seed_game()
    service = ZapLedger()

    first_event = _build_event(1010, [["proof-of-play-zap-target", "GAME", game.id, "150000"]])
    second_tags = [
        ["proof-of-play-zap-target", "GAME", game.id, "25000", "FORWARDED"],
        ["proof-of-play-zap-target", "PLATFORM", "", "4000", "FORWARDED"],
    ]
    second_event = _build_event(2020, second_tags, created_at=int(datetime.now(tz=timezone.utc).timestamp()) + 60)

    with session_scope() as session:
        service.record_event(session=session, event=first_event)
        service.record_event(session=session, event=second_event)

    client = TestClient(create_application())
    response = client.get("/v1/zaps/summary")
    assert response.status_code == 200

    payload = response.json()
    assert payload["platform"]["lnurl"] == "lnurl1proofofplay"

    assert payload["games"]["total_msats"] == 175_000
    assert payload["games"]["zap_count"] == 2

    game_sources = {item["source"]: item for item in payload["games"]["source_totals"]}
    assert game_sources["DIRECT"]["total_msats"] == 150_000
    assert game_sources["FORWARDED"]["total_msats"] == 25_000

    top_games = payload["games"]["top_games"]
    assert len(top_games) == 1
    top_entry = top_games[0]
    assert top_entry["game_id"] == game.id
    assert top_entry["slug"] == game.slug
    assert top_entry["total_msats"] == 175_000

    platform_sources = {item["source"]: item for item in payload["platform"]["source_totals"]}
    assert platform_sources["FORWARDED"]["total_msats"] == 4_000
    assert payload["platform"]["total_msats"] == 4_000
    assert payload["platform"]["zap_count"] == 1


def test_zap_summary_endpoint_handles_missing_nostr_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The zap summary endpoint should return null LNURL when settings are absent."""

    monkeypatch.delenv("NOSTR_RELAYS", raising=False)
    monkeypatch.delenv("PLATFORM_PUBKEY", raising=False)
    monkeypatch.delenv("PLATFORM_SIGNING_KEY_HEX", raising=False)
    monkeypatch.delenv("PLATFORM_SIGNING_KEY_PATH", raising=False)
    monkeypatch.delenv("PLATFORM_LNURL", raising=False)
    clear_nostr_publisher_settings_cache()

    _create_schema()

    client = TestClient(create_application())
    response = client.get("/v1/zaps/summary")
    assert response.status_code == 200

    payload = response.json()
    assert payload["platform"]["lnurl"] is None
