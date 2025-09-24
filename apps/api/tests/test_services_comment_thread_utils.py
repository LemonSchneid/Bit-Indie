from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import pytest

from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import (
    Developer,
    Game,
    InvoiceStatus,
    Purchase,
    User,
)
from bit_indie_api.services.comment_thread.utils import (
    decode_npub,
    encode_npub,
    extract_alias_pubkeys,
    normalize_hex_key,
    normalize_pubkey_value,
)
from bit_indie_api.services.comment_thread.verification import load_verified_user_ids


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run each test against an isolated in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create the ORM schema for the temporary SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _create_developer(session) -> Developer:
    """Persist and return a developer linked to a new user."""

    user = User(pubkey_hex=f"developer-{uuid.uuid4().hex}")
    session.add(user)
    session.flush()

    developer = Developer(user_id=user.id)
    session.add(developer)
    session.flush()
    return developer


def _create_game(session, developer: Developer) -> Game:
    """Persist and return a game owned by the supplied developer."""

    game = Game(
        developer_id=developer.id,
        title="Nebula Drift",
        slug=f"nebula-drift-{uuid.uuid4().hex[:8]}",
    )
    session.add(game)
    session.flush()
    return game


def test_normalize_hex_key_accepts_valid_hex() -> None:
    """Valid pubkey hex strings should be lowercased and returned."""

    key = "ABCDEF" * 10 + "ABCD"
    assert len(key) == 64

    assert normalize_hex_key(key) == key.lower()
    assert normalize_hex_key(key.lower()) == key.lower()


def test_normalize_hex_key_rejects_invalid_values() -> None:
    """Invalid hex inputs should return ``None``."""

    assert normalize_hex_key(None) is None
    assert normalize_hex_key("not-hex") is None
    assert normalize_hex_key("abcd") is None


def test_normalize_pubkey_value_supports_bech32_and_prefix() -> None:
    """Normalization should handle raw hex, nostr-prefixed hex, and npub values."""

    hex_key = "1234" * 16
    npub = encode_npub(hex_key)
    assert npub is not None

    assert normalize_pubkey_value(hex_key.upper()) == hex_key
    assert normalize_pubkey_value(f"nostr:{hex_key}") == hex_key
    assert normalize_pubkey_value(npub.upper()) == hex_key
    assert normalize_pubkey_value("npub1invalid") is None


def test_encode_decode_npub_round_trip() -> None:
    """Encoding then decoding a key should return the original bytes."""

    hex_key = "00ff" * 16
    encoded = encode_npub(hex_key)
    assert encoded is not None
    assert encoded.startswith("npub1")

    decoded = decode_npub(encoded)
    assert decoded.hex() == hex_key

    assert encode_npub("not-hex") is None
    with pytest.raises(ValueError):
        decode_npub("npub1badformat")


def test_extract_alias_pubkeys_filters_to_primary() -> None:
    """Alias extraction should only surface keys matching the primary pubkey."""

    primary = "deadbeef" * 8
    npub = encode_npub(primary)
    assert npub is not None

    tags = json.dumps(
        [
            ["alias", primary.upper()],
            ["npub", npub],
            ["npub", "npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqz6w0z7"],
            ["p", "should-ignore"],
        ]
    )

    aliases = extract_alias_pubkeys(tags, primary)
    assert aliases == (primary,)
    assert extract_alias_pubkeys("not-json", primary) == (primary,)
    assert extract_alias_pubkeys(None, None) == ()


def test_load_verified_user_ids_returns_paid_purchasers() -> None:
    """Helper should return the subset of user IDs with settled purchases."""

    _create_schema()

    with session_scope() as session:
        developer = _create_developer(session)
        game = _create_game(session, developer)

        paid_user = User(pubkey_hex=f"paid-{uuid.uuid4().hex}")
        pending_user = User(pubkey_hex=f"pending-{uuid.uuid4().hex}")
        session.add_all([paid_user, pending_user])
        session.flush()
        paid_user_id = paid_user.id
        pending_user_id = pending_user.id

        purchase_paid = Purchase(
            user_id=paid_user_id,
            game_id=game.id,
            invoice_id="invoice-paid",
            invoice_status=InvoiceStatus.PAID,
            amount_msats=5_000,
            paid_at=datetime.now(timezone.utc),
        )
        purchase_pending = Purchase(
            user_id=pending_user_id,
            game_id=game.id,
            invoice_id="invoice-pending",
            invoice_status=InvoiceStatus.PENDING,
            amount_msats=5_000,
        )
        session.add_all([purchase_paid, purchase_pending])
        session.flush()

        result = load_verified_user_ids(
            session=session,
            game_id=game.id,
            user_ids=[paid_user_id, pending_user_id, None, paid_user_id],
        )

    assert result == {paid_user_id}


def test_load_verified_user_ids_handles_empty_iterables() -> None:
    """Providing no user identifiers should short-circuit the query."""

    _create_schema()

    with session_scope() as session:
        result = load_verified_user_ids(
            session=session,
            game_id="game-unknown",
            user_ids=[],
        )

    assert result == set()
