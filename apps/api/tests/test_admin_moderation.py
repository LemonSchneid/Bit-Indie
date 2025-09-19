from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from proof_of_play_api.api.v1.routes.comments import get_comment_thread_service
from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    Comment,
    Developer,
    Game,
    GameStatus,
    ModerationFlag,
    ModerationFlagReason,
    ModerationFlagStatus,
    ModerationTargetType,
    ReleaseNoteReply,
    ReleaseNoteReplyHiddenReason,
    Review,
    User,
)
from proof_of_play_api.main import create_application


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Ensure each test case executes against a clean in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    get_comment_thread_service().clear_cache()
    yield
    reset_database_state()
    get_comment_thread_service().clear_cache()


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
        user = User(pubkey_hex=f"user-{uuid.uuid4().hex}", is_admin=is_admin)
        session.add(user)
        session.flush()
        return user.id


def _create_game(*, status: GameStatus = GameStatus.UNLISTED, active: bool = True) -> str:
    """Persist a developer-owned game and return its identifier."""

    with session_scope() as session:
        dev_user = User(pubkey_hex=f"dev-{uuid.uuid4().hex}")
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


def _create_review(game_id: str, user_id: str, *, body: str = "Needs moderation") -> str:
    """Persist a review for the provided game and return its identifier."""

    with session_scope() as session:
        review = Review(
            game_id=game_id,
            user_id=user_id,
            body_md=body,
            rating=1,
            created_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        )
        session.add(review)
        session.flush()
        return review.id


def _create_release_note_reply(game_id: str, *, content: str = "Great update") -> str:
    """Persist a release note reply associated with the provided game."""

    release_note_event_id = f"event-{uuid.uuid4().hex}"
    with session_scope() as session:
        reply = ReleaseNoteReply(
            game_id=game_id,
            release_note_event_id=release_note_event_id,
            relay_url="https://relay.admin/replies",
            event_id=f"reply-{uuid.uuid4().hex}",
            pubkey=f"{uuid.uuid4().hex}{uuid.uuid4().hex}",
            kind=1,
            event_created_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
            content=content,
            tags_json=json.dumps([["e", release_note_event_id]]),
        )
        session.add(reply)
        session.flush()
        return reply.id


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


def test_takedown_hides_reviews_and_marks_flags() -> None:
    """Moderation takedowns should hide reviews and resolve their flags."""

    _create_schema()
    admin_id = _create_user(is_admin=True)
    reporter_id = _create_user()
    player_id = _create_user()
    game_id = _create_game()
    review_id = _create_review(game_id, player_id)
    flag_id = _create_flag(
        target_type=ModerationTargetType.REVIEW,
        target_id=review_id,
        reporter_id=reporter_id,
        reason=ModerationFlagReason.TOS,
    )

    client = _build_client()
    response = client.post(
        "/v1/admin/mod/takedown",
        json={
            "user_id": admin_id,
            "target_type": ModerationTargetType.REVIEW.value,
            "target_id": review_id,
        },
    )

    assert response.status_code == 200

    with session_scope() as session:
        review = session.get(Review, review_id)
        assert review is not None
        assert review.is_hidden is True
        flag = session.get(ModerationFlag, flag_id)
        assert flag is not None
        assert flag.status is ModerationFlagStatus.ACTIONED


def test_admin_hide_release_note_reply_updates_comments() -> None:
    """Hiding a release note reply should remove it from storefront responses."""

    _create_schema()
    admin_id = _create_user(is_admin=True)
    game_id = _create_game()
    reply_id = _create_release_note_reply(game_id)

    client = _build_client()

    response = client.get(f"/v1/games/{game_id}/comments")
    assert response.status_code == 200
    assert len(response.json()) == 1

    hide_response = client.post(
        f"/v1/admin/mod/replies/{reply_id}/hide",
        json={"user_id": admin_id, "notes": "spam"},
    )

    assert hide_response.status_code == 200
    payload = hide_response.json()
    assert payload["is_hidden"] is True
    assert payload["hidden_reason"] == ReleaseNoteReplyHiddenReason.ADMIN.value
    assert payload["moderation_notes"] == "spam"

    response = client.get(f"/v1/games/{game_id}/comments")
    assert response.status_code == 200
    assert response.json() == []

    unhide_response = client.post(
        f"/v1/admin/mod/replies/{reply_id}/unhide",
        json={"user_id": admin_id},
    )

    assert unhide_response.status_code == 200
    restored = unhide_response.json()
    assert restored["is_hidden"] is False
    assert restored["hidden_reason"] is None

    response = client.get(f"/v1/games/{game_id}/comments")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_admin_can_fetch_hidden_release_note_reply() -> None:
    """Audit endpoint should return hidden release note replies for admins."""

    _create_schema()
    admin_id = _create_user(is_admin=True)
    game_id = _create_game()
    release_note_event_id = f"event-{uuid.uuid4().hex}"

    with session_scope() as session:
        reply = ReleaseNoteReply(
            game_id=game_id,
            release_note_event_id=release_note_event_id,
            relay_url="https://relay.audit/replies",
            event_id=f"reply-{uuid.uuid4().hex}",
            pubkey=f"{uuid.uuid4().hex}{uuid.uuid4().hex}",
            kind=1,
            event_created_at=datetime(2024, 1, 3, tzinfo=timezone.utc),
            content="Auto hidden reply",
            tags_json=json.dumps([["e", release_note_event_id]]),
            is_hidden=True,
            hidden_reason=ReleaseNoteReplyHiddenReason.AUTOMATED_FILTER,
            moderation_notes="Reply contains profanity.",
        )
        session.add(reply)
        session.flush()
        reply_id = reply.id

    client = _build_client()
    response = client.get(
        f"/v1/admin/mod/replies/{reply_id}", params={"user_id": admin_id}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == reply_id
    assert body["is_hidden"] is True
    assert body["hidden_reason"] == ReleaseNoteReplyHiddenReason.AUTOMATED_FILTER.value
    assert body["moderation_notes"] == "Reply contains profanity."
