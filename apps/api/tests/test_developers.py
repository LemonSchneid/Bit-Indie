"""Tests covering the developer profile lifecycle endpoints."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import Developer, User
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
    """Run each test against isolated database and login challenge store instances."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    reset_login_challenge_store()
    yield
    reset_database_state()
    reset_login_challenge_store()


def _create_schema() -> None:
    """Create all ORM tables for the in-memory test database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    """Return a FastAPI test client bound to a fresh application instance."""

    return TestClient(create_application())


def _sign_event(secret_key: int, *, challenge: str, created_at: int) -> dict[str, object]:
    """Construct and sign a login event with the configured secret key."""

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


def test_create_developer_profile_persists_and_returns_payload() -> None:
    """Posting to the developer endpoint should persist and return the profile."""

    _create_schema()
    with session_scope() as session:
        user = User(pubkey_hex="abc123")
        session.add(user)
        session.flush()
        user_id = user.id

    client = _build_client()
    payload = {
        "user_id": user_id,
        "profile_url": "https://studio.example.com",
        "contact_email": "dev@example.com",
    }

    response = client.post("/v1/devs", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["user_id"] == user_id
    assert body["profile_url"] == payload["profile_url"]
    assert body["contact_email"] == payload["contact_email"]

    with session_scope() as session:
        stored = session.get(Developer, body["id"])
        assert stored is not None
        assert stored.profile_url == payload["profile_url"]
        assert stored.contact_email == payload["contact_email"]


def test_create_developer_profile_requires_valid_user() -> None:
    """An unknown user identifier should return a 404 response."""

    _create_schema()
    client = _build_client()

    response = client.post(
        "/v1/devs",
        json={
            "user_id": "missing",
        },
    )

    assert response.status_code == 404


def test_login_response_marks_user_as_developer_after_profile_creation() -> None:
    """After creating a developer profile, the login payload should set is_developer."""

    _create_schema()
    client = _build_client()

    secret_key = 123456789
    challenge = client.post("/v1/auth/challenge").json()["challenge"]
    created_at = int(datetime.now(tz=timezone.utc).timestamp())
    signed_event = _sign_event(secret_key, challenge=challenge, created_at=created_at)

    login_response = client.post("/v1/auth/verify", json={"event": signed_event})
    assert login_response.status_code == 200
    user_payload = login_response.json()["user"]
    assert user_payload["is_developer"] is False

    developer_response = client.post(
        "/v1/devs",
        json={
            "user_id": user_payload["id"],
            "profile_url": None,
            "contact_email": None,
        },
    )
    assert developer_response.status_code == 201

    second_challenge = client.post("/v1/auth/challenge").json()["challenge"]
    second_event = _sign_event(
        secret_key,
        challenge=second_challenge,
        created_at=int(datetime.now(tz=timezone.utc).timestamp()),
    )
    second_login = client.post("/v1/auth/verify", json={"event": second_event})

    assert second_login.status_code == 200
    assert second_login.json()["user"]["is_developer"] is True
