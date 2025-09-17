from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import Comment, Developer, Game, GameStatus, User
from proof_of_play_api.main import create_application


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Ensure each test runs against isolated database state."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create ORM tables for the in-memory SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    """Return a FastAPI client bound to a fresh application instance."""

    return TestClient(create_application())


def _seed_game(*, active: bool = True) -> str:
    """Persist a developer-owned game and return its identifier."""

    with session_scope() as session:
        developer_user = User(pubkey_hex=f"dev-{uuid.uuid4().hex}")
        session.add(developer_user)
        session.flush()

        developer = Developer(user_id=developer_user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Nebula Drift",
            slug=f"nebula-drift-{uuid.uuid4().hex[:8]}",
            status=GameStatus.UNLISTED,
            active=active,
        )
        session.add(game)
        session.flush()
        game_id = game.id

    return game_id


def _create_user() -> str:
    """Persist a standalone user and return its identifier."""

    with session_scope() as session:
        user = User(pubkey_hex=f"user-{uuid.uuid4().hex}")
        session.add(user)
        session.flush()
        user_id = user.id

    return user_id


def test_create_comment_persists_and_returns_payload() -> None:
    """Posting a comment should persist the record and return the stored payload."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={"user_id": user_id, "body_md": "  Excited to play this build!  "},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["game_id"] == game_id
    assert body["user_id"] == user_id
    assert body["body_md"] == "Excited to play this build!"

    with session_scope() as session:
        stored = session.get(Comment, body["id"])
        assert stored is not None
        assert stored.body_md == "Excited to play this build!"


def test_create_comment_requires_known_user() -> None:
    """Submitting a comment with an unknown user should return a 404 error."""

    _create_schema()
    game_id = _seed_game(active=True)
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={"user_id": "missing", "body_md": "Hello"},
    )

    assert response.status_code == 404


def test_create_comment_rejects_inactive_game() -> None:
    """Attempting to comment on an inactive game should return a 404 response."""

    _create_schema()
    game_id = _seed_game(active=False)
    user_id = _create_user()
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={"user_id": user_id, "body_md": "Looks awesome"},
    )

    assert response.status_code == 404


def test_list_comments_returns_chronological_order() -> None:
    """Listing comments should return them sorted by creation timestamp."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()

    first_created = datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc)
    second_created = datetime(2024, 1, 2, 9, 30, tzinfo=timezone.utc)

    with session_scope() as session:
        first = Comment(game_id=game_id, user_id=user_id, body_md="First!", created_at=first_created)
        second = Comment(game_id=game_id, user_id=user_id, body_md="Can't wait", created_at=second_created)
        session.add_all([first, second])

    client = _build_client()
    response = client.get(f"/v1/games/{game_id}/comments")

    assert response.status_code == 200
    body = response.json()
    assert [item["body_md"] for item in body] == ["First!", "Can't wait"]
    assert body[0]["created_at"] < body[1]["created_at"]

