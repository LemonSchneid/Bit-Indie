"""End-to-end tests for the Nostr authentication flow."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import sqlalchemy as sa
import pytest
from fastapi.testclient import TestClient

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import User
from proof_of_play_api.main import create_application
from proof_of_play_api.services.auth import reset_login_challenge_store
from proof_of_play_api.services.nostr import calculate_event_id, derive_xonly_public_key, schnorr_sign


NOSTR_ENABLED = os.getenv("NOSTR_ENABLED", "false").lower() == "true"

pytestmark = pytest.mark.skipif(
    not NOSTR_ENABLED,
    reason="Nostr features are disabled for the Simple MVP",
)


LOGIN_KIND = 22242


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Run each test against an isolated in-memory database and challenge store."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    reset_login_challenge_store()
    yield
    reset_database_state()
    reset_login_challenge_store()


def _create_schema() -> None:
    """Create the ORM schema for the in-memory database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    """Return a test client bound to a freshly created FastAPI app."""

    return TestClient(create_application())


def _sign_event(secret_key: int, *, challenge: str, created_at: int) -> dict[str, object]:
    """Construct and sign a login event for use in tests."""

    pubkey_hex = derive_xonly_public_key(secret_key).hex()
    tags = [["challenge", challenge], ["client", "proof-of-play-tests"]]
    base_event = {
        "pubkey": pubkey_hex,
        "created_at": created_at,
        "kind": LOGIN_KIND,
        "tags": tags,
        "content": "Proof of Play login",
    }
    event_id = calculate_event_id(**base_event)
    signature = schnorr_sign(bytes.fromhex(event_id), secret_key)
    return {
        **base_event,
        "id": event_id,
        "sig": signature.hex(),
    }


def test_issue_login_challenge_returns_payload() -> None:
    """The challenge endpoint should provide challenge and timestamps."""

    _create_schema()
    client = _build_client()

    response = client.post("/v1/auth/challenge")

    assert response.status_code == 200
    payload = response.json()
    assert "challenge" in payload
    assert "issued_at" in payload
    assert "expires_at" in payload
    assert isinstance(payload["challenge"], str)


def test_verify_login_creates_user_record() -> None:
    """A valid signed challenge should upsert the user into the database."""

    _create_schema()
    client = _build_client()

    challenge_response = client.post("/v1/auth/challenge")
    challenge_value = challenge_response.json()["challenge"]

    created_at = int(datetime.now(tz=timezone.utc).timestamp())
    signed_event = _sign_event(123456789, challenge=challenge_value, created_at=created_at)

    response = client.post("/v1/auth/verify", json={"event": signed_event})

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["pubkey_hex"] == signed_event["pubkey"]
    assert body["user"]["is_developer"] is False
    assert body["user"]["created_at"] is not None
    assert body["user"]["updated_at"] is not None
    created_at = datetime.fromisoformat(body["user"]["created_at"])
    updated_at = datetime.fromisoformat(body["user"]["updated_at"])
    assert updated_at >= created_at

    with session_scope() as session:
        count = session.scalar(sa.select(sa.func.count()).select_from(User))
        assert count == 1

    second_attempt = client.post("/v1/auth/verify", json={"event": signed_event})
    assert second_attempt.status_code == 400


def test_verify_login_rejects_invalid_signature() -> None:
    """Signatures that do not verify must be rejected with 401."""

    _create_schema()
    client = _build_client()

    challenge_value = client.post("/v1/auth/challenge").json()["challenge"]
    created_at = int(datetime.now(tz=timezone.utc).timestamp())
    event = _sign_event(42, challenge=challenge_value, created_at=created_at)

    bad_signature = "00" * 64
    event["sig"] = bad_signature

    response = client.post("/v1/auth/verify", json={"event": event})
    assert response.status_code == 401


def test_verify_login_requires_challenge_tag() -> None:
    """Events without the challenge tag are not accepted."""

    _create_schema()
    client = _build_client()

    # Issue a challenge to ensure the store is primed but omit the tag when signing.
    _ = client.post("/v1/auth/challenge")

    created_at = int(datetime.now(tz=timezone.utc).timestamp())
    secret_key = 98765
    pubkey_hex = derive_xonly_public_key(secret_key).hex()
    base_event = {
        "pubkey": pubkey_hex,
        "created_at": created_at,
        "kind": LOGIN_KIND,
        "tags": [],
        "content": "Proof of Play login",
    }
    event_id = calculate_event_id(**base_event)
    signature = schnorr_sign(bytes.fromhex(event_id), secret_key)
    payload = {
        **base_event,
        "id": event_id,
        "sig": signature.hex(),
    }

    response = client.post("/v1/auth/verify", json={"event": payload})
    assert response.status_code == 400
