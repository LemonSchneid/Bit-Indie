from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import Comment, Developer, Game, GameStatus, User
from proof_of_play_api.main import create_application
from proof_of_play_api.services.proof_of_work import (
    PROOF_OF_WORK_DIFFICULTY_BITS,
    calculate_proof_of_work_hash,
    count_leading_zero_bits,
)
from proof_of_play_api.services.rate_limiting import COMMENT_RATE_LIMIT_MAX_ITEMS


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


def _create_user(*, reputation_score: int = 0) -> str:
    """Persist a standalone user and return its identifier."""

    with session_scope() as session:
        user = User(pubkey_hex=f"user-{uuid.uuid4().hex}", reputation_score=reputation_score)
        session.add(user)
        session.flush()
        user_id = user.id

    return user_id


def _mine_proof_of_work(*, user_id: str, resource_id: str, body_md: str) -> dict[str, int]:
    """Return proof-of-work data satisfying the configured difficulty."""

    nonce = 0
    while True:
        digest = calculate_proof_of_work_hash(
            user_id=user_id,
            resource_id=resource_id,
            payload=body_md,
            nonce=nonce,
        )
        if count_leading_zero_bits(digest) >= PROOF_OF_WORK_DIFFICULTY_BITS:
            return {"nonce": nonce}
        nonce += 1


def test_create_comment_persists_and_returns_payload() -> None:
    """Posting a comment should persist the record and return the stored payload."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user(reputation_score=25)
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
    user_id = _create_user(reputation_score=25)
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={"user_id": user_id, "body_md": "Looks awesome"},
    )

    assert response.status_code == 404


def test_create_comment_requires_proof_of_work_for_low_reputation() -> None:
    """Low reputation users must provide proof of work when posting a comment."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={"user_id": user_id, "body_md": "Need access"},
    )

    assert response.status_code == 400
    assert "proof of work" in response.json()["detail"].lower()


def test_create_comment_accepts_valid_proof_of_work() -> None:
    """Supplying valid proof of work should allow a low reputation comment to post."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()
    client = _build_client()
    body_md = "First impressions"
    proof = _mine_proof_of_work(
        user_id=user_id,
        resource_id=f"comment:{game_id}",
        body_md=body_md,
    )

    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={
            "user_id": user_id,
            "body_md": body_md,
            "proof_of_work": proof,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["body_md"] == body_md


def test_create_comment_enforces_rate_limit() -> None:
    """Users exceeding the rate limit should receive a 429 response."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user(reputation_score=50)
    now = datetime.now(timezone.utc)

    with session_scope() as session:
        for index in range(COMMENT_RATE_LIMIT_MAX_ITEMS):
            session.add(
                Comment(
                    game_id=game_id,
                    user_id=user_id,
                    body_md=f"seed-{index}",
                    created_at=now - timedelta(seconds=index + 1),
                )
            )

    client = _build_client()
    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={"user_id": user_id, "body_md": "One more thought"},
    )

    assert response.status_code == 429
    assert "rate limit" in response.json()["detail"].lower()
    assert "Retry-After" in response.headers


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


def test_list_comments_excludes_hidden_entries() -> None:
    """Hidden comments should not appear in the public listing."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()

    with session_scope() as session:
        visible = Comment(game_id=game_id, user_id=user_id, body_md="Visible note")
        hidden = Comment(
            game_id=game_id,
            user_id=user_id,
            body_md="Hidden note",
            is_hidden=True,
        )
        session.add_all([visible, hidden])

    client = _build_client()
    response = client.get(f"/v1/games/{game_id}/comments")

    assert response.status_code == 200
    body = response.json()
    assert [item["body_md"] for item in body] == ["Visible note"]

