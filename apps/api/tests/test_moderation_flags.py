"""Tests for the player-facing moderation flag API."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import (
    Comment,
    Developer,
    Game,
    GameStatus,
    ModerationFlag,
    ModerationFlagReason,
    ModerationFlagStatus,
    ModerationTargetType,
    User,
)
from bit_indie_api.main import create_application
from bit_indie_api.services.rate_limiting import FLAG_RATE_LIMIT_MAX_ITEMS


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Ensure each test executes against isolated database state."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create ORM tables for the in-memory SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    """Return a FastAPI test client bound to a fresh application instance."""

    return TestClient(create_application())


def _create_user(*, is_admin: bool = False) -> str:
    """Persist a user and return its identifier."""

    with session_scope() as session:
        user = User(account_identifier=f"user-{uuid.uuid4().hex}", is_admin=is_admin)
        session.add(user)
        session.flush()
        return user.id


def _create_game(*, status: GameStatus = GameStatus.DISCOVER, active: bool = True) -> str:
    """Persist a game owned by a developer and return its identifier."""

    with session_scope() as session:
        developer_user = User(account_identifier=f"dev-{uuid.uuid4().hex}")
        session.add(developer_user)
        session.flush()

        developer = Developer(user_id=developer_user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Flaggable Game",
            slug=f"flaggable-{uuid.uuid4().hex[:8]}",
            status=status,
            active=active,
        )
        session.add(game)
        session.flush()
        return game.id


def _create_comment(game_id: str, user_id: str) -> str:
    """Persist a comment attached to the provided game and return its identifier."""

    with session_scope() as session:
        comment = Comment(game_id=game_id, user_id=user_id, body_md="Needs review")
        session.add(comment)
        session.flush()
        return comment.id


def test_create_flag_requires_existing_user() -> None:
    """The API should reject moderation flags from unknown users."""

    _create_schema()
    game_id = _create_game()
    client = _build_client()

    response = client.post(
        "/v1/moderation/flags",
        json={
            "user_id": "missing-user",
            "target_type": ModerationTargetType.GAME.value,
            "target_id": game_id,
            "reason": ModerationFlagReason.SPAM.value,
        },
    )

    assert response.status_code == 404
    assert "user" in response.json()["detail"].lower()


def test_create_flag_requires_valid_target() -> None:
    """Submitting a flag for a non-existent target should yield a 404 response."""

    _create_schema()
    user_id = _create_user()
    client = _build_client()

    response = client.post(
        "/v1/moderation/flags",
        json={
            "user_id": user_id,
            "target_type": ModerationTargetType.GAME.value,
            "target_id": "missing-game",
            "reason": ModerationFlagReason.DMCA.value,
        },
    )

    assert response.status_code == 404
    assert "target" in response.json()["detail"].lower()


@pytest.mark.parametrize(
    "target_type, factory",
    [
        (ModerationTargetType.GAME, _create_game),
        (ModerationTargetType.COMMENT, _create_comment),
    ],
)
def test_create_flag_persists_record(
    target_type: ModerationTargetType,
    factory,
) -> None:
    """Valid submissions should persist moderation flags for supported target types."""

    _create_schema()
    reporter_id = _create_user()
    subject_user = _create_user()
    game_id = _create_game()

    if target_type is ModerationTargetType.GAME:
        target_id = game_id
    else:
        target_id = factory(game_id, subject_user)

    client = _build_client()
    response = client.post(
        "/v1/moderation/flags",
        json={
            "user_id": reporter_id,
            "target_type": target_type.value,
            "target_id": target_id,
            "reason": ModerationFlagReason.SPAM.value,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["target_type"] == target_type.value
    assert body["target_id"] == target_id
    assert body["reason"] == ModerationFlagReason.SPAM.value
    assert body["status"] == ModerationFlagStatus.OPEN.value

    with session_scope() as session:
        stored = session.scalar(select(ModerationFlag).where(ModerationFlag.id == body["id"]))
        assert stored is not None
        assert stored.user_id == reporter_id
        assert stored.target_id == target_id


def test_create_flag_is_idempotent_for_open_flags() -> None:
    """Submitting a duplicate flag should return the existing open flag."""

    _create_schema()
    reporter_id = _create_user()
    offender_id = _create_user()
    game_id = _create_game()
    comment_id = _create_comment(game_id, offender_id)

    with session_scope() as session:
        existing = ModerationFlag(
            user_id=reporter_id,
            target_type=ModerationTargetType.COMMENT,
            target_id=comment_id,
            reason=ModerationFlagReason.SPAM,
        )
        session.add(existing)
        session.flush()
        existing_id = existing.id

    client = _build_client()
    response = client.post(
        "/v1/moderation/flags",
        json={
            "user_id": reporter_id,
            "target_type": ModerationTargetType.COMMENT.value,
            "target_id": comment_id,
            "reason": ModerationFlagReason.MALWARE.value,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == existing_id
    assert body["reason"] == ModerationFlagReason.SPAM.value


def test_create_flag_enforces_rate_limit() -> None:
    """Users exceeding the flag rate limit should receive a 429 response."""

    _create_schema()
    reporter_id = _create_user()
    offender_id = _create_user()
    game_id = _create_game()
    now = datetime.now(timezone.utc)

    with session_scope() as session:
        for index in range(FLAG_RATE_LIMIT_MAX_ITEMS):
            flag = ModerationFlag(
                user_id=reporter_id,
                target_type=ModerationTargetType.GAME,
                target_id=f"game-{index}",
                reason=ModerationFlagReason.SPAM,
                created_at=now - timedelta(seconds=index + 1),
            )
            session.add(flag)

    comment_id = _create_comment(game_id, offender_id)

    client = _build_client()
    response = client.post(
        "/v1/moderation/flags",
        json={
            "user_id": reporter_id,
            "target_type": ModerationTargetType.COMMENT.value,
            "target_id": comment_id,
            "reason": ModerationFlagReason.TOS.value,
        },
    )

    assert response.status_code == 429
    assert "rate limit" in response.json()["detail"].lower()
    assert "Retry-After" in response.headers
