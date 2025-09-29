"""Tests covering the game publication workflow service."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import (
    Developer,
    Game,
    GameStatus,
    InvoiceStatus,
    Purchase,
    RefundStatus,
    Review,
    User,
)
from bit_indie_api.services.game_publication import GamePublicationService



@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure each test runs against a fresh in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create all ORM tables for the temporary SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _create_developer(session) -> tuple[User, Developer]:
    """Return a persisted developer user pair for fixtures."""

    user = User(account_identifier=f"dev-{uuid.uuid4().hex}")
    session.add(user)
    session.flush()

    developer = Developer(user_id=user.id)
    session.add(developer)
    session.flush()

    return user, developer


def _add_buyer(session, index: int) -> User:
    """Persist a buyer for generating purchase and review history."""

    buyer = User(account_identifier=f"buyer-{index}-{uuid.uuid4().hex}")
    session.add(buyer)
    session.flush()
    return buyer


def _seed_featured_metrics(session, game: Game, reference: datetime) -> None:
    """Populate a game with purchases and reviews meeting featured thresholds."""

    for index in range(10):
        buyer = _add_buyer(session, index)
        purchase = Purchase(
            user_id=buyer.id,
            game_id=game.id,
            invoice_id=f"invoice-{index}",
            invoice_status=InvoiceStatus.PAID,
            amount_msats=5_000,
            paid_at=reference - timedelta(days=2),
            refund_status=RefundStatus.NONE,
        )
        session.add(purchase)

        review = Review(
            game_id=game.id,
            user_id=buyer.id,
            body_md="Great pacing and soundtrack.",
            rating=5,
            is_verified_purchase=True,
        )
        session.add(review)

    session.flush()
    session.refresh(game)
    game.updated_at = reference - timedelta(days=5)
    session.flush()


def test_publish_game_promotes_to_featured_when_thresholds_met() -> None:
    """Publishing a qualified game should reconcile featured placement."""

    _create_schema()
    reference = datetime(2024, 7, 1, 12, 0, tzinfo=timezone.utc)
    service = GamePublicationService()

    with session_scope() as session:
        _, developer = _create_developer(session)
        game = Game(
            developer_id=developer.id,
            title="Starlight Drift",
            slug="starlight-drift",
            active=False,
            status=GameStatus.UNLISTED,
        )
        session.add(game)
        session.flush()

        _seed_featured_metrics(session, game, reference)

        result = service.publish(
            session=session,
            game=game,
            reference=reference,
        )

        assert result.featured_status_changed is True
        assert result.featured_eligibility.meets_thresholds is True
        assert game.status is GameStatus.FEATURED
        assert game.active is True


def test_unpublish_game_demotes_featured_listing() -> None:
    """Unpublishing should deactivate the game and clear featured placement."""

    _create_schema()
    reference = datetime(2024, 7, 2, 15, 30, tzinfo=timezone.utc)
    service = GamePublicationService()

    with session_scope() as session:
        _, developer = _create_developer(session)
        game = Game(
            developer_id=developer.id,
            title="Lunar Echo",
            slug="lunar-echo",
            active=True,
            status=GameStatus.FEATURED,
            updated_at=reference - timedelta(days=3),
        )
        session.add(game)
        session.flush()

        _seed_featured_metrics(session, game, reference)

        result = service.unpublish(session=session, game=game, reference=reference)

        assert result.featured_status_changed is True
        assert result.featured_eligibility.meets_thresholds is False
        assert game.active is False
        assert game.status is GameStatus.UNLISTED

