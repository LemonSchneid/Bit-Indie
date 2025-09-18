"""Tests covering administrative refund payout endpoints."""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    Developer,
    Game,
    GameStatus,
    InvoiceStatus,
    Purchase,
    RefundPayout,
    RefundStatus,
    User,
)
from proof_of_play_api.main import create_application


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
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


def _create_admin_user(*, is_admin: bool) -> str:
    """Persist a user and return its identifier."""

    with session_scope() as session:
        user = User(pubkey_hex=f"user-{uuid.uuid4().hex}", is_admin=is_admin)
        session.add(user)
        session.flush()
        return user.id


def _create_paid_purchase(*, amount_msats: int = 5000) -> tuple[str, str]:
    """Persist a buyer, developer, game, and paid purchase returning their identifiers."""

    with session_scope() as session:
        buyer = User(pubkey_hex=f"buyer-{uuid.uuid4().hex}")
        session.add(buyer)
        session.flush()

        developer_user = User(pubkey_hex=f"dev-{uuid.uuid4().hex}")
        session.add(developer_user)
        session.flush()

        developer = Developer(user_id=developer_user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Refundable Game",
            slug=f"refundable-game-{uuid.uuid4().hex[:8]}",
            price_msats=amount_msats,
            active=True,
            status=GameStatus.DISCOVER,
        )
        session.add(game)
        session.flush()

        purchase = Purchase(
            user_id=buyer.id,
            game_id=game.id,
            invoice_id="hash123",
            invoice_status=InvoiceStatus.PAID,
            amount_msats=amount_msats,
            paid_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            download_granted=True,
        )
        session.add(purchase)
        session.flush()

        return buyer.id, purchase.id


def test_admin_records_refund_and_creates_payout() -> None:
    """Administrators should be able to mark a purchase as refunded."""

    _create_schema()
    admin_id = _create_admin_user(is_admin=True)
    _, purchase_id = _create_paid_purchase()
    client = _build_client()

    response = client.post(
        f"/v1/admin/refunds/{purchase_id}",
        json={
            "user_id": admin_id,
            "amount_msats": 4500,
            "payment_reference": "lnbc-refund",
            "notes": "Manual payout processed",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["purchase"]["invoice_status"] == InvoiceStatus.REFUNDED.value
    assert payload["purchase"]["refund_status"] == RefundStatus.PAID.value
    assert payload["purchase"]["refund_requested"] is True
    assert payload["purchase"]["download_granted"] is False
    assert payload["payout"]["amount_msats"] == 4500
    assert payload["payout"]["payment_reference"] == "lnbc-refund"

    with session_scope() as session:
        purchase = session.get(Purchase, purchase_id)
        assert purchase is not None
        assert purchase.invoice_status is InvoiceStatus.REFUNDED
        assert purchase.refund_status is RefundStatus.PAID
        assert purchase.refund_requested is True
        assert purchase.download_granted is False

        payout = session.scalar(select(RefundPayout).where(RefundPayout.purchase_id == purchase_id))
        assert payout is not None
        assert payout.amount_msats == 4500
        assert payout.payment_reference == "lnbc-refund"
        assert payout.processed_by_id == admin_id


def test_admin_refund_requires_admin_privileges() -> None:
    """Only admin users should be permitted to record refund payouts."""

    _create_schema()
    non_admin_id = _create_admin_user(is_admin=False)
    _, purchase_id = _create_paid_purchase()
    client = _build_client()

    response = client.post(
        f"/v1/admin/refunds/{purchase_id}",
        json={"user_id": non_admin_id},
    )

    assert response.status_code == 403

    with session_scope() as session:
        purchase = session.get(Purchase, purchase_id)
        assert purchase is not None
        assert purchase.invoice_status is InvoiceStatus.PAID
        assert purchase.refund_status is RefundStatus.NONE
        assert session.scalar(select(RefundPayout)) is None


def test_admin_refund_rejects_unpaid_purchase() -> None:
    """Refund payouts should be rejected for unpaid purchases."""

    _create_schema()
    admin_id = _create_admin_user(is_admin=True)
    with session_scope() as session:
        buyer = User(pubkey_hex=f"buyer2-{uuid.uuid4().hex}")
        session.add(buyer)
        session.flush()

        developer_user = User(pubkey_hex=f"dev2-{uuid.uuid4().hex}")
        session.add(developer_user)
        session.flush()

        developer = Developer(user_id=developer_user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Pending Game",
            slug=f"pending-game-{uuid.uuid4().hex[:8]}",
            status=GameStatus.UNLISTED,
            active=True,
        )
        session.add(game)
        session.flush()

        purchase = Purchase(
            user_id=buyer.id,
            game_id=game.id,
            invoice_id="hash789",
            invoice_status=InvoiceStatus.PENDING,
            amount_msats=4000,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    client = _build_client()
    response = client.post(
        f"/v1/admin/refunds/{purchase_id}",
        json={"user_id": admin_id},
    )

    assert response.status_code == 400

    with session_scope() as session:
        purchase = session.get(Purchase, purchase_id)
        assert purchase is not None
        assert purchase.invoice_status is InvoiceStatus.PENDING
        assert purchase.refund_status is RefundStatus.NONE
        assert session.scalar(select(RefundPayout)) is None
