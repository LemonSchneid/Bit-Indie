from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from bit_indie_api.core.config import clear_settings_cache, get_settings
from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import Developer, User
from bit_indie_api.main import create_application
from bit_indie_api.services.session_tokens import create_session_token


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run each test against isolated in-memory database instances."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("API_SESSION_SECRET", "test-session-secret")
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


def _issue_token(user_id: str) -> str:
    """Return a signed session token for authenticated requests."""

    settings = get_settings()
    return create_session_token(
        user_id=user_id,
        secret=settings.session_secret,
        ttl_seconds=settings.session_ttl_seconds,
    )


def test_create_developer_profile_persists_and_returns_payload() -> None:
    """Posting to the developer endpoint should persist and return the profile."""

    _create_schema()
    with session_scope() as session:
        user = User(account_identifier="abc123")
        session.add(user)
        session.flush()
        user_id = user.id

    client = _build_client()
    token = _issue_token(user_id)
    payload = {
        "user_id": user_id,
        "profile_url": "https://studio.example.com",
        "contact_email": "dev@example.com",
    }

    response = client.post(
        "/v1/devs",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )

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
        assert stored.user.is_developer is True


def test_create_developer_profile_requires_valid_user() -> None:
    """An unknown user identifier should return a 404 response."""

    _create_schema()
    client = _build_client()

    token = _issue_token("missing")
    response = client.post(
        "/v1/devs",
        json={
            "user_id": "missing",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_get_developer_profile_requires_authentication() -> None:
    """Requests without credentials should be rejected."""

    _create_schema()
    with session_scope() as session:
        user = User(account_identifier="dev-auth")
        developer = Developer(user=user)
        session.add_all([user, developer])
        session.flush()
        user_id = user.id

    client = _build_client()
    response = client.get(f"/v1/devs/{user_id}")

    assert response.status_code == 401


def test_get_developer_profile_enforces_ownership() -> None:
    """Users should not retrieve developer profiles they do not own."""

    _create_schema()
    with session_scope() as session:
        owner = User(account_identifier="owner")
        intruder = User(account_identifier="intruder")
        session.add_all([owner, intruder])
        session.flush()
        developer = Developer(user=owner)
        session.add(developer)
        session.flush()
        owner_id = owner.id
        intruder_id = intruder.id

    client = _build_client()
    token = _issue_token(intruder_id)
    response = client.get(
        f"/v1/devs/{owner_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_get_developer_profile_returns_serialized_payload() -> None:
    """The endpoint should return the persisted developer profile."""

    _create_schema()
    with session_scope() as session:
        user = User(account_identifier="dev-user")
        profile = Developer(
            user=user,
            profile_url="https://studio.example.com",
            contact_email="studio@example.com",
        )
        session.add_all([user, profile])
        session.flush()
        user_id = user.id

    client = _build_client()
    token = _issue_token(user_id)
    response = client.get(
        f"/v1/devs/{user_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == user_id
    assert body["profile_url"] == "https://studio.example.com"
    assert body["contact_email"] == "studio@example.com"


def test_create_developer_profile_requires_authentication() -> None:
    """Creating a profile without credentials should return 401."""

    _create_schema()
    with session_scope() as session:
        user = User(account_identifier="no-auth")
        session.add(user)
        session.flush()
        user_id = user.id

    client = _build_client()
    response = client.post(
        "/v1/devs",
        json={"user_id": user_id},
    )

    assert response.status_code == 401


def test_create_developer_profile_rejects_mismatched_user() -> None:
    """Users cannot manage profiles for other accounts."""

    _create_schema()
    with session_scope() as session:
        owner = User(account_identifier="owner-2")
        intruder = User(account_identifier="intruder-2")
        session.add_all([owner, intruder])
        session.flush()
        owner_id = owner.id
        intruder_id = intruder.id

    client = _build_client()
    token = _issue_token(intruder_id)
    response = client.post(
        "/v1/devs",
        json={"user_id": owner_id},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
