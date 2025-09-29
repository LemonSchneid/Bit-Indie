"""Unit tests for the first-party comment thread service."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid

import pytest

from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import Comment, Developer, Game, GameStatus, InvoiceStatus, Purchase, User
from bit_indie_api.services.comment_thread import CommentDTO, CommentSource, CommentThreadService


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run each test against an isolated in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create ORM tables for the temporary SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _create_developer(session) -> tuple[User, Developer]:
    """Persist and return a developer and their linked user."""

    user = User(account_identifier=f"developer-{uuid.uuid4().hex}")
    session.add(user)
    session.flush()

    developer = Developer(user_id=user.id)
    session.add(developer)
    session.flush()

    return user, developer


def _create_game(session, developer: Developer) -> Game:
    """Persist a game owned by the provided developer."""

    game = Game(
        developer_id=developer.id,
        title="Nebula Drift",
        slug=f"nebula-drift-{uuid.uuid4().hex[:8]}",
        status=GameStatus.UNLISTED,
        active=True,
    )
    session.add(game)
    session.flush()
    return game


def _create_user(session, *, lightning_address: str | None = None) -> User:
    """Persist a user record and return the ORM instance."""

    user = User(
        account_identifier=f"user-{uuid.uuid4().hex}",
        lightning_address=lightning_address,
        display_name="Player",
    )
    session.add(user)
    session.flush()
    return user


def _create_comment(session, *, game_id: str, user_id: str, body_md: str, created_at: datetime) -> Comment:
    """Persist a first-party comment for the provided game."""

    comment = Comment(
        game_id=game_id,
        user_id=user_id,
        body_md=body_md,
        created_at=created_at,
    )
    session.add(comment)
    session.flush()
    return comment


def _create_purchase(session, *, game_id: str, user_id: str, paid_at: datetime) -> None:
    """Persist a paid purchase linking the user to the game."""

    purchase = Purchase(
        user_id=user_id,
        game_id=game_id,
        invoice_id=f"invoice-{uuid.uuid4().hex[:8]}",
        invoice_status=InvoiceStatus.PAID,
        amount_msats=5_000,
        paid_at=paid_at,
    )
    session.add(purchase)


def test_list_for_game_orders_first_party_comments() -> None:
    """Comments should be returned in chronological order without external data."""

    _create_schema()
    service = CommentThreadService()

    with session_scope() as session:
        _, developer = _create_developer(session)
        game = _create_game(session, developer)
        first_user = _create_user(session, lightning_address="player@example.com")
        second_user = _create_user(session)

        older = _create_comment(
            session,
            game_id=game.id,
            user_id=first_user.id,
            body_md="First!",
            created_at=datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc),
        )
        newer = _create_comment(
            session,
            game_id=game.id,
            user_id=second_user.id,
            body_md="Looking forward to the release",
            created_at=datetime(2024, 1, 1, 12, 5, tzinfo=timezone.utc),
        )
        older_id = older.id
        newer_id = newer.id

        comments = service.list_for_game(session=session, game=game)

    assert [comment.id for comment in comments] == [older_id, newer_id]
    assert all(comment.source is CommentSource.FIRST_PARTY for comment in comments)
    assert comments[0].author.lightning_address == "player@example.com"
    assert comments[1].author.lightning_address is None


def test_list_for_game_marks_verified_purchase_users() -> None:
    """Users with paid purchases should surface as verified."""

    _create_schema()
    service = CommentThreadService()

    with session_scope() as session:
        _, developer = _create_developer(session)
        game = _create_game(session, developer)
        purchaser = _create_user(session)
        spectator = _create_user(session)

        _create_purchase(
            session,
            game_id=game.id,
            user_id=purchaser.id,
            paid_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
        )

        purchase_comment = _create_comment(
            session,
            game_id=game.id,
            user_id=purchaser.id,
            body_md="Downloaded and loved it!",
            created_at=datetime(2024, 1, 3, tzinfo=timezone.utc),
        )
        spectator_comment = _create_comment(
            session,
            game_id=game.id,
            user_id=spectator.id,
            body_md="Watching the development closely.",
            created_at=datetime(2024, 1, 4, tzinfo=timezone.utc),
        )
        purchase_comment_id = purchase_comment.id
        spectator_comment_id = spectator_comment.id

        comments = service.list_for_game(session=session, game=game)

    verified_flags = {comment.id: comment.is_verified_purchase for comment in comments}
    assert verified_flags[purchase_comment_id] is True
    assert verified_flags[spectator_comment_id] is False


def test_serialize_comment_requires_persisted_user() -> None:
    """Serializing a comment without a resolved user should raise a ValueError."""

    _create_schema()
    service = CommentThreadService()

    with session_scope() as session:
        _, developer = _create_developer(session)
        game = _create_game(session, developer)
        user = _create_user(session)
        comment = _create_comment(
            session,
            game_id=game.id,
            user_id=user.id,
            body_md="Hello",
            created_at=datetime.now(timezone.utc),
        )
        comment.user_id = "missing"
        comment.user = None

        with pytest.raises(ValueError):
            service.serialize_comment(session=session, comment=comment)


def test_serialize_comment_returns_dto() -> None:
    """Serializing a new comment should return a populated DTO."""

    _create_schema()
    service = CommentThreadService()

    with session_scope() as session:
        _, developer = _create_developer(session)
        game = _create_game(session, developer)
        user = _create_user(session)
        comment = _create_comment(
            session,
            game_id=game.id,
            user_id=user.id,
            body_md="Excited!",
            created_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
        )

        comment_id = comment.id
        user_id = user.id
        dto = service.serialize_comment(session=session, comment=comment)

    assert isinstance(dto, CommentDTO)
    assert dto.id == comment_id
    assert dto.source is CommentSource.FIRST_PARTY
    assert dto.author.user_id == user_id
    assert dto.is_verified_purchase is False
