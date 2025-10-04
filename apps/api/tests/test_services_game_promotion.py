"""Tests for promotion helpers that manage featured rotation state."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid

import pytest

from sqlalchemy import select

from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import (
    Comment,
    Developer,
    Game,
    GameStatus,
    InvoiceStatus,
    Purchase,
    RefundStatus,
    User,
)
from bit_indie_api.services.game_promotion import (
    evaluate_featured_eligibility,
    update_game_featured_status,
)


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run each test against an isolated in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create the ORM schema for the temporary SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _create_developer(session) -> tuple[User, Developer]:
    """Return a persisted developer and their user account."""

    user = User(account_identifier=f"dev-{uuid.uuid4().hex}")
    session.add(user)
    session.flush()

    developer = Developer(user_id=user.id)
    session.add(developer)
    session.flush()

    return user, developer


def _add_buyer(session, index: int) -> User:
    """Persist and return a buyer user for test fixtures."""

    buyer = User(account_identifier=f"buyer-{index}-{uuid.uuid4().hex}")
    session.add(buyer)
    session.flush()
    return buyer


def test_evaluate_featured_eligibility_meets_thresholds() -> None:
    """Games that satisfy all metrics should report eligibility and promote."""

    _create_schema()
    reference = datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)

    with session_scope() as session:
        _, developer = _create_developer(session)
        game = Game(
            developer_id=developer.id,
            title="Nebula Drift",
            slug="nebula-drift",
            active=True,
            status=GameStatus.DISCOVER,
            updated_at=reference - timedelta(days=7),
        )
        session.add(game)
        session.flush()

        for index in range(10):
            buyer = _add_buyer(session, index)
            purchase = Purchase(
                user_id=buyer.id,
                game_id=game.id,
                invoice_id=f"invoice-{index}",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=5_000,
                paid_at=reference - timedelta(days=3),
                refund_status=RefundStatus.NONE,
            )
            session.add(purchase)
            comment = Comment(
                game_id=game.id,
                user_id=buyer.id,
                body_md="Loved the momentum and soundtrack.",
            )
            session.add(comment)

        session.flush()
        session.refresh(game)
        game.updated_at = reference - timedelta(days=7)
        session.flush()

        eligibility = evaluate_featured_eligibility(session=session, game=game, reference=reference)
        assert eligibility.meets_thresholds is True
        assert eligibility.verified_comment_count == 10
        assert eligibility.paid_purchase_count == 10
        assert eligibility.refunded_purchase_count == 0

        changed, _ = update_game_featured_status(
            session=session, game=game, reference=reference, eligibility=eligibility
        )
        assert changed is True
        assert game.status is GameStatus.FEATURED


def test_update_game_featured_status_demotes_on_refund_rate() -> None:
    """A game should lose featured status when refund rates exceed limits."""

    _create_schema()
    reference = datetime(2024, 6, 1, 10, 0, tzinfo=timezone.utc)

    with session_scope() as session:
        _, developer = _create_developer(session)
        game = Game(
            developer_id=developer.id,
            title="Signal Cascade",
            slug="signal-cascade",
            active=True,
            status=GameStatus.FEATURED,
            updated_at=reference - timedelta(days=5),
        )
        session.add(game)
        session.flush()

        for index in range(12):
            buyer = _add_buyer(session, index)
            purchase = Purchase(
                user_id=buyer.id,
                game_id=game.id,
                invoice_id=f"refund-check-{index}",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=7_500,
                paid_at=reference - timedelta(days=4),
                refund_status=RefundStatus.NONE,
            )
            session.add(purchase)
            comment = Comment(
                game_id=game.id,
                user_id=buyer.id,
                body_md="Tense puzzler with great feedback loops.",
            )
            session.add(comment)

        # Mark enough refunds to breach the 5% limit (2 of 12 ≈ 16.6%).
        refunded_purchase_ids = session.scalars(
            select(Purchase.id).where(Purchase.game_id == game.id).limit(2)
        ).all()
        for purchase_id in refunded_purchase_ids:
            purchase = session.get(Purchase, purchase_id)
            assert purchase is not None
            purchase.refund_status = RefundStatus.PAID

        session.flush()
        session.refresh(game)
        game.updated_at = reference - timedelta(days=5)
        session.flush()

        changed, eligibility = update_game_featured_status(session=session, game=game, reference=reference)
        assert changed is True
        assert eligibility.meets_thresholds is False
        assert game.status is GameStatus.DISCOVER
