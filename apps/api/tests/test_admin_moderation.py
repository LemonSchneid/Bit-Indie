from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

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


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Ensure each test case executes against a clean in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create ORM tables for the SQLite test database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    """Return a configured FastAPI test client."""

    return TestClient(create_application())


def _create_user(*, is_admin: bool = False) -> str:
    """Persist a user with optional admin privileges and return its identifier."""

    with session_scope() as session:
        user = User(account_identifier=f"user-{uuid.uuid4().hex}", is_admin=is_admin)
        session.add(user)
        session.flush()
        return user.id


def _create_game(*, status: GameStatus = GameStatus.UNLISTED, active: bool = True) -> str:
    """Persist a developer-owned game and return its identifier."""

    with session_scope() as session:
        dev_user = User(account_identifier=f"dev-{uuid.uuid4().hex}")
        session.add(dev_user)
        session.flush()

        developer = Developer(user_id=dev_user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Flagged Game",
            slug=f"flagged-game-{uuid.uuid4().hex[:8]}",
            status=status,
            active=active,
        )
        session.add(game)
        session.flush()
        return game.id


def _create_comment(game_id: str, user_id: str, *, body: str = "Needs moderation") -> str:
    """Persist a comment for the provided game and return its identifier."""

    with session_scope() as session:
        comment = Comment(game_id=game_id, user_id=user_id, body_md=body)
        session.add(comment)
        session.flush()
        return comment.id


def _create_flag(
    *,
    target_type: ModerationTargetType,
    target_id: str,
    reporter_id: str,
    reason: ModerationFlagReason = ModerationFlagReason.SPAM,
) -> str:
    """Persist a moderation flag and return its identifier."""

    with session_scope() as session:
        flag = ModerationFlag(
            target_type=target_type,
            target_id=target_id,
            user_id=reporter_id,
            reason=reason,
        )
        session.add(flag)
        session.flush()
        return flag.id


def test_queue_requires_admin_privileges() -> None:
    """The moderation queue endpoint should reject non-admin users."""

    _create_schema()
    user_id = _create_user(is_admin=False)
    client = _build_client()

    response = client.get("/v1/admin/mod/queue", params={"user_id": user_id})

    assert response.status_code == 403


def test_takedown_requires_admin_privileges() -> None:
    """The takedown endpoint should reject non-admin requests."""

    _create_schema()
    non_admin = _create_user(is_admin=False)
    reporter_id = _create_user()
    game_id = _create_game()
    comment_id = _create_comment(game_id, reporter_id)
    _create_flag(
        target_type=ModerationTargetType.COMMENT,
        target_id=comment_id,
        reporter_id=reporter_id,
    )

    client = _build_client()
    response = client.post(
        "/v1/admin/mod/takedown",
        json={
            "user_id": non_admin,
            "target_type": ModerationTargetType.COMMENT.value,
            "target_id": comment_id,
        },
    )

    assert response.status_code == 403


def test_queue_returns_flag_details_for_admins() -> None:
    """Administrators should receive the details of open moderation flags."""

    _create_schema()
    admin_id = _create_user(is_admin=True)
    reporter_id = _create_user()
    player_id = _create_user()
    game_id = _create_game(status=GameStatus.DISCOVER, active=True)
    comment_id = _create_comment(game_id, player_id, body="Potential spam")
    flag_id = _create_flag(
        target_type=ModerationTargetType.COMMENT,
        target_id=comment_id,
        reporter_id=reporter_id,
        reason=ModerationFlagReason.SPAM,
    )

    client = _build_client()
    response = client.get("/v1/admin/mod/queue", params={"user_id": admin_id})

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 1
    item = body[0]
    assert item["id"] == flag_id
    assert item["target_type"] == ModerationTargetType.COMMENT.value
    assert item["comment"]["body_md"] == "Potential spam"
    assert item["game"]["id"] == game_id
    assert item["reporter"]["id"] == reporter_id


def test_takedown_unlists_game_and_marks_flags_actioned() -> None:
    """Applying a takedown to a game should deactivate the listing and close flags."""

    _create_schema()
    admin_id = _create_user(is_admin=True)
    reporter_id = _create_user()
    game_id = _create_game(status=GameStatus.DISCOVER, active=True)
    flag_id = _create_flag(
        target_type=ModerationTargetType.GAME,
        target_id=game_id,
        reporter_id=reporter_id,
        reason=ModerationFlagReason.DMCA,
    )

    client = _build_client()
    response = client.post(
        "/v1/admin/mod/takedown",
        json={
            "user_id": admin_id,
            "target_type": ModerationTargetType.GAME.value,
            "target_id": game_id,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["applied_status"] == ModerationFlagStatus.ACTIONED.value
    assert flag_id in body["affected_flag_ids"]

    with session_scope() as session:
        game = session.get(Game, game_id)
        assert game is not None
        assert game.active is False
        assert game.status is GameStatus.UNLISTED
        flag = session.get(ModerationFlag, flag_id)
        assert flag is not None
        assert flag.status is ModerationFlagStatus.ACTIONED


def test_takedown_hides_comments_and_marks_flags() -> None:
    """Moderation takedowns should hide comments and resolve the flag queue."""

    _create_schema()
    admin_id = _create_user(is_admin=True)
    reporter_id = _create_user()
    player_id = _create_user()
    game_id = _create_game()
    comment_id = _create_comment(game_id, player_id)
    flag_id = _create_flag(
        target_type=ModerationTargetType.COMMENT,
        target_id=comment_id,
        reporter_id=reporter_id,
    )

    client = _build_client()
    response = client.post(
        "/v1/admin/mod/takedown",
        json={
            "user_id": admin_id,
            "target_type": ModerationTargetType.COMMENT.value,
            "target_id": comment_id,
        },
    )

    assert response.status_code == 200

    with session_scope() as session:
        comment = session.get(Comment, comment_id)
        assert comment is not None
        assert comment.is_hidden is True
        flag = session.get(ModerationFlag, flag_id)
        assert flag is not None
        assert flag.status is ModerationFlagStatus.ACTIONED


def test_hidden_content_listing_requires_admin_privileges() -> None:
    """The hidden content endpoint should reject non-admin users."""

    _create_schema()
    non_admin = _create_user(is_admin=False)
    client = _build_client()

    response = client.get("/v1/admin/mod/hidden", params={"user_id": non_admin})

    assert response.status_code == 403


def test_hidden_content_listing_returns_comments() -> None:
    """Admins should be able to view hidden comments for restoration."""

    _create_schema()
    admin_id = _create_user(is_admin=True)
    commenter = _create_user()
    game_id = _create_game(status=GameStatus.DISCOVER, active=True)

    with session_scope() as session:
        comment = Comment(
            game_id=game_id,
            user_id=commenter,
            body_md="Hidden comment",
            is_hidden=True,
            created_at=datetime(2024, 3, 1, tzinfo=timezone.utc),
        )
        session.add(comment)

    client = _build_client()
    response = client.get("/v1/admin/mod/hidden", params={"user_id": admin_id})

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 1
    assert body[0]["target_type"] == ModerationTargetType.COMMENT.value
    assert body[0]["comment"]["body_md"] == "Hidden comment"


def test_restore_comment_unhides_content_and_dismisses_flags() -> None:
    """Restoring a comment should unhide it and dismiss associated flags."""

    _create_schema()
    admin_id = _create_user(is_admin=True)
    commenter = _create_user()
    reporter = _create_user()
    game_id = _create_game()
    comment_id = _create_comment(game_id, commenter)

    with session_scope() as session:
        comment = session.get(Comment, comment_id)
        assert comment is not None
        comment.is_hidden = True
        flag = ModerationFlag(
            target_type=ModerationTargetType.COMMENT,
            target_id=comment_id,
            user_id=reporter,
            reason=ModerationFlagReason.SPAM,
            status=ModerationFlagStatus.ACTIONED,
        )
        session.add(flag)

    client = _build_client()
    response = client.post(
        "/v1/admin/mod/restore",
        json={
            "user_id": admin_id,
            "target_type": ModerationTargetType.COMMENT.value,
            "target_id": comment_id,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["applied_status"] == ModerationFlagStatus.DISMISSED.value

    with session_scope() as session:
        comment = session.get(Comment, comment_id)
        assert comment is not None
        assert comment.is_hidden is False
        flags = session.scalars(
            select(ModerationFlag).where(ModerationFlag.target_id == comment_id)
        ).all()
        assert all(flag.status is ModerationFlagStatus.DISMISSED for flag in flags)

