"""Tests covering the lifecycle of game draft endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import Developer, Game, GameCategory, User
from proof_of_play_api.main import create_application
from proof_of_play_api.services.auth import reset_login_challenge_store


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


def _create_user_and_developer(*, with_developer: bool) -> str:
    """Persist a user (and optionally developer profile) returning the user identifier."""

    with session_scope() as session:
        user = User(pubkey_hex="user-pubkey")
        session.add(user)
        session.flush()
        user_id = user.id

        if with_developer:
            developer = Developer(user_id=user_id)
            session.add(developer)

    return user_id


def test_create_game_draft_requires_developer_profile() -> None:
    """Posting a game draft should fail when the user lacks a developer profile."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=False)
    client = _build_client()

    response = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Space Odyssey",
            "slug": "space-odyssey",
        },
    )

    assert response.status_code == 400


def test_create_game_draft_persists_and_returns_payload() -> None:
    """Creating a game draft should persist the record and return the stored payload."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client = _build_client()

    response = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Neon Drift",
            "slug": "Neon-Drift",
            "summary": "Slide through cyber streets.",
            "price_msats": 1500,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Neon Drift"
    assert body["slug"] == "neon-drift"
    assert body["summary"] == "Slide through cyber streets."
    assert body["price_msats"] == 1500
    assert body["category"] == GameCategory.PROTOTYPE.value

    with session_scope() as session:
        stored = session.get(Game, body["id"])
        assert stored is not None
        assert stored.title == "Neon Drift"
        assert stored.slug == "neon-drift"
        assert stored.summary == "Slide through cyber streets."
        assert stored.price_msats == 1500


def test_create_game_draft_rejects_duplicate_slug() -> None:
    """Attempting to reuse a slug should return a conflict error."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client = _build_client()

    first = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Echo Valley",
            "slug": "echo-valley",
        },
    )
    assert first.status_code == 201

    second = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Echo Valley Remix",
            "slug": "echo-valley",
        },
    )

    assert second.status_code == 409


def test_update_game_draft_applies_changes() -> None:
    """Updating a draft should persist the supplied field changes."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client = _build_client()

    created = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Quantum Trails",
            "slug": "quantum-trails",
            "summary": "Initial summary.",
        },
    )
    assert created.status_code == 201
    game_id = created.json()["id"]

    update = client.put(
        f"/v1/games/{game_id}",
        json={
            "user_id": user_id,
            "title": "Quantum Trails DX",
            "slug": "quantum-trails-dx",
            "summary": None,
            "category": GameCategory.EARLY_ACCESS.value,
        },
    )

    assert update.status_code == 200
    body = update.json()
    assert body["title"] == "Quantum Trails DX"
    assert body["slug"] == "quantum-trails-dx"
    assert body["summary"] is None
    assert body["category"] == GameCategory.EARLY_ACCESS.value

    with session_scope() as session:
        stored = session.get(Game, game_id)
        assert stored is not None
        assert stored.title == "Quantum Trails DX"
        assert stored.slug == "quantum-trails-dx"
        assert stored.summary is None
        assert stored.category == GameCategory.EARLY_ACCESS


def test_update_game_draft_rejects_other_developers() -> None:
    """A developer should not be able to modify another developer's draft."""

    _create_schema()
    owner_id = _create_user_and_developer(with_developer=True)
    intruder_id = _create_user_and_developer(with_developer=True)
    client = _build_client()

    created = client.post(
        "/v1/games",
        json={
            "user_id": owner_id,
            "title": "Starlight",
            "slug": "starlight",
        },
    )
    assert created.status_code == 201
    game_id = created.json()["id"]

    response = client.put(
        f"/v1/games/{game_id}",
        json={
            "user_id": intruder_id,
            "title": "Starlight Deluxe",
        },
    )

    assert response.status_code == 403
