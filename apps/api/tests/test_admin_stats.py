from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import (
    Developer,
    Game,
    GameStatus,
    InvoiceStatus,
    ModerationFlag,
    ModerationFlagReason,
    ModerationFlagStatus,
    ModerationTargetType,
    Purchase,
    RefundPayout,
    RefundStatus,
    User,
)
from bit_indie_api.main import create_application


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure each test executes against a clean in-memory database."""

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


def _create_game(*, price_msats: int = 5_000) -> str:
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
            title="Moderated Game",
            slug=f"moderated-game-{uuid.uuid4().hex[:8]}",
            status=GameStatus.DISCOVER,
            active=True,
            price_msats=price_msats,
        )
        session.add(game)
        session.flush()
        return game.id


def test_integrity_stats_require_admin() -> None:
    """Only administrators should be able to view integrity metrics."""

    _create_schema()
    non_admin_id = _create_user(is_admin=False)
    client = _build_client()

    response = client.get("/v1/admin/stats", params={"user_id": non_admin_id})

    assert response.status_code == 403


def test_integrity_stats_return_aggregated_metrics() -> None:
    """The stats endpoint should summarize refund and moderation data."""

    _create_schema()
    admin_id = _create_user(is_admin=True)
    game_id = _create_game()

    paid_at = datetime(2024, 3, 1, tzinfo=timezone.utc)

    with session_scope() as session:
        buyer_one = User(account_identifier=f"buyer-one-{uuid.uuid4().hex}")
        buyer_two = User(account_identifier=f"buyer-two-{uuid.uuid4().hex}")
        buyer_three = User(account_identifier=f"buyer-three-{uuid.uuid4().hex}")
        session.add_all([buyer_one, buyer_two, buyer_three])
        session.flush()

        purchases = [
            Purchase(
                user_id=buyer_one.id,
                game_id=game_id,
                invoice_id="invoice-paid-1",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=5_000,
                paid_at=paid_at,
                download_granted=True,
            ),
            Purchase(
                user_id=buyer_two.id,
                game_id=game_id,
                invoice_id="invoice-paid-2",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=6_000,
                paid_at=paid_at,
                download_granted=True,
            ),
            Purchase(
                user_id=buyer_three.id,
                game_id=game_id,
                invoice_id="invoice-refunded-1",
                invoice_status=InvoiceStatus.REFUNDED,
                amount_msats=4_000,
                paid_at=paid_at,
                refund_requested=True,
                refund_status=RefundStatus.PAID,
            ),
            Purchase(
                user_id=buyer_three.id,
                game_id=game_id,
                invoice_id="invoice-refunded-2",
                invoice_status=InvoiceStatus.REFUNDED,
                amount_msats=3_000,
                paid_at=paid_at,
                refund_requested=True,
                refund_status=RefundStatus.PAID,
            ),
            Purchase(
                user_id=buyer_two.id,
                game_id=game_id,
                invoice_id="invoice-pending-1",
                invoice_status=InvoiceStatus.PENDING,
                amount_msats=7_500,
            ),
        ]
        session.add_all(purchases)
        session.flush()

        payouts = [
            RefundPayout(
                purchase_id=purchases[2].id,
                processed_by_id=admin_id,
                amount_msats=3_500,
                payment_reference="lnbc-refund-1",
            ),
            RefundPayout(
                purchase_id=purchases[3].id,
                processed_by_id=admin_id,
                amount_msats=3_000,
                payment_reference="lnbc-refund-2",
            ),
        ]
        session.add_all(payouts)

        reporter = User(account_identifier=f"reporter-{uuid.uuid4().hex}")
        session.add(reporter)
        session.flush()

        flags = [
            ModerationFlag(
                target_type=ModerationTargetType.GAME,
                target_id=game_id,
                user_id=reporter.id,
                reason=ModerationFlagReason.SPAM,
                status=ModerationFlagStatus.ACTIONED,
            ),
            ModerationFlag(
                target_type=ModerationTargetType.GAME,
                target_id=game_id,
                user_id=reporter.id,
                reason=ModerationFlagReason.MALWARE,
                status=ModerationFlagStatus.ACTIONED,
            ),
            ModerationFlag(
                target_type=ModerationTargetType.GAME,
                target_id=game_id,
                user_id=reporter.id,
                reason=ModerationFlagReason.TOS,
                status=ModerationFlagStatus.DISMISSED,
            ),
            ModerationFlag(
                target_type=ModerationTargetType.GAME,
                target_id=game_id,
                user_id=reporter.id,
                reason=ModerationFlagReason.SPAM,
            ),
        ]
        session.add_all(flags)
        session.flush()

    client = _build_client()
    response = client.get("/v1/admin/stats", params={"user_id": admin_id})

    assert response.status_code == 200
    payload = response.json()

    assert payload["paid_purchase_count"] == 4
    assert payload["refunded_purchase_count"] == 2
    assert payload["total_refund_payout_msats"] == 6_500
    assert payload["total_flag_count"] == 4
    assert payload["actioned_flag_count"] == 2
    assert payload["dismissed_flag_count"] == 1
    assert payload["open_flag_count"] == 1
    assert payload["handled_flag_count"] == 3
    assert payload["refund_rate"] == pytest.approx(0.5)
    assert payload["takedown_rate"] == pytest.approx(0.5)
    assert payload["estimated_moderation_hours"] == pytest.approx(0.3, rel=1e-3)
