from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from sqlalchemy import select

from bit_indie_api.core.config import clear_settings_cache
from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import User
from bit_indie_api.main import create_application
from bit_indie_api.services.passwords import hash_password, verify_password


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run each test with isolated in-memory settings and database state."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("API_SESSION_SECRET", "test-session-secret")
    monkeypatch.setenv("API_SESSION_TTL_SECONDS", "3600")
    reset_database_state()
    clear_settings_cache()
    yield
    reset_database_state()
    clear_settings_cache()


def _create_schema() -> None:
    """Create the ORM schema for the in-memory database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    """Return a test client bound to a freshly created FastAPI app."""

    return TestClient(create_application())


def test_signup_persists_user_and_returns_session_token() -> None:
    """Signing up should persist credentials and return a session token."""

    _create_schema()
    client = _build_client()

    response = client.post(
        "/v1/auth/signup",
        json={
            "email": "player@example.com",
            "password": "Supers3cret!",
            "display_name": "Player One",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "player@example.com"
    assert body["session_token"]

    with session_scope() as session:
        stored = session.scalars(
            select(User).where(User.email == "player@example.com")
        ).first()
        assert stored is not None
        assert stored.password_hash is not None
        assert stored.password_hash != "Supers3cret!"
        assert verify_password("Supers3cret!", stored.password_hash)


def test_signup_rejects_duplicate_email() -> None:
    """Registering with an existing email should return a conflict response."""

    _create_schema()
    with session_scope() as session:
        existing = User(
            account_identifier="acct-existing",
            email="player@example.com",
            password_hash=hash_password("ExistingPass1!"),
        )
        session.add(existing)

    client = _build_client()
    response = client.post(
        "/v1/auth/signup",
        json={"email": "player@example.com", "password": "AnotherPass1!"},
    )

    assert response.status_code == 409


def test_login_returns_session_for_valid_credentials() -> None:
    """Logging in with the correct credentials should issue a session token."""

    _create_schema()
    with session_scope() as session:
        user = User(
            account_identifier="acct-login",
            email="player@example.com",
            password_hash=hash_password("ValidPass1!"),
        )
        session.add(user)
        session.flush()
        stored_id = user.id

    client = _build_client()
    response = client.post(
        "/v1/auth/login",
        json={"email": "player@example.com", "password": "ValidPass1!"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["id"] == stored_id
    assert body["session_token"]


def test_login_rejects_invalid_credentials() -> None:
    """Invalid passwords should not reveal account existence."""

    _create_schema()
    with session_scope() as session:
        user = User(
            account_identifier="acct-login",
            email="player@example.com",
            password_hash=hash_password("ValidPass1!"),
        )
        session.add(user)

    client = _build_client()
    response = client.post(
        "/v1/auth/login",
        json={"email": "player@example.com", "password": "WrongPass"},
    )

    assert response.status_code == 401


def test_refresh_requires_valid_session_and_returns_new_token() -> None:
    """Refreshing a session should require authentication and return a new token."""

    _create_schema()
    with session_scope() as session:
        user = User(
            account_identifier="acct-refresh",
            email="player@example.com",
            password_hash=hash_password("RefreshPass1!"),
        )
        session.add(user)
        session.flush()
        user_id = user.id

    client = _build_client()
    login_response = client.post(
        "/v1/auth/login",
        json={"email": "player@example.com", "password": "RefreshPass1!"},
    )
    token = login_response.json()["session_token"]

    refresh_response = client.post(
        "/v1/auth/refresh",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert refresh_response.status_code == 200
    refreshed = refresh_response.json()
    assert refreshed["user"]["id"] == user_id
    assert refreshed["session_token"] != token


def test_logout_requires_valid_token() -> None:
    """Logging out without authentication should fail."""

    _create_schema()
    client = _build_client()

    response = client.post("/v1/auth/logout")

    assert response.status_code == 401


