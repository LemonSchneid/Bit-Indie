from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import Developer, User
from bit_indie_api.main import create_application


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run each test against isolated in-memory database instances."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create the ORM schema for the in-memory database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    """Return a test client bound to a freshly created FastAPI app."""

    return TestClient(create_application())


def test_create_developer_profile_persists_and_returns_payload() -> None:
    """Posting to the developer endpoint should persist and return the profile."""

    _create_schema()
    with session_scope() as session:
        user = User(account_identifier="abc123")
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
        assert stored.user.is_developer is True


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
