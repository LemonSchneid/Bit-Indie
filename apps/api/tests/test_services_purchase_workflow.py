from __future__ import annotations

from datetime import datetime, timezone
import uuid

import pytest
from sqlalchemy import select

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    Developer,
    DownloadAuditLog,
    Game,
    GameStatus,
    InvoiceStatus,
    Purchase,
    RefundStatus,
    User,
)
from proof_of_play_api.services.guest_checkout import GuestCheckoutService
from proof_of_play_api.services.payments import InvoiceStatus as ProviderInvoiceStatus
from proof_of_play_api.services.purchase_workflow import (
    MissingLookupIdentifierError,
    PurchaseBuildUnavailableError,
    PurchaseNotDownloadableError,
    PurchaseNotRefundableError,
    PurchasePermissionError,
    PurchaseWorkflowService,
)
from proof_of_play_api.services.storage import PresignedDownload


class _StubPaymentService:
    """Test double that returns preconfigured invoice status responses."""

    def __init__(self) -> None:
        self.status_responses: dict[str, ProviderInvoiceStatus] = {}

    def get_invoice_status(self, *, invoice_id: str) -> ProviderInvoiceStatus:
        try:
            return self.status_responses[invoice_id]
        except KeyError:  # pragma: no cover - defensive guard for unexpected calls
            raise AssertionError(f"Unexpected status lookup for {invoice_id}.")


class _StubStorageService:
    """Test double that records object key requests for downloads."""

    def __init__(self) -> None:
        self.object_keys: list[str] = []
        self.response = PresignedDownload(
            url="https://downloads.example.com/build.zip?token=abc",
            expires_at=datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc),
        )

    def create_presigned_download(self, *, object_key: str) -> PresignedDownload:
        self.object_keys.append(object_key)
        return self.response


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
    """Persist and return a developer with their user account."""

    user = User(pubkey_hex=f"dev-{uuid.uuid4().hex}")
    session.add(user)
    session.flush()

    developer = Developer(user_id=user.id)
    session.add(developer)
    session.flush()

    return user, developer


def _create_game(
    session,
    *,
    developer: Developer,
    price_msats: int = 5_000,
    active: bool = True,
    status: GameStatus = GameStatus.UNLISTED,
    build_object_key: str | None = None,
) -> Game:
    """Persist a game associated with ``developer``."""

    game = Game(
        developer_id=developer.id,
        title="Nebula Drift",
        slug=f"nebula-drift-{uuid.uuid4().hex}",
        price_msats=price_msats,
        active=active,
        status=status,
        build_object_key=build_object_key,
    )
    session.add(game)
    session.flush()
    return game


def _build_service(
    session,
    *,
    payments: _StubPaymentService | None = None,
    storage: _StubStorageService | None = None,
) -> PurchaseWorkflowService:
    """Instantiate a workflow service bound to ``session`` for testing."""

    return PurchaseWorkflowService(
        session=session,
        guest_checkout=GuestCheckoutService(session=session),
        payments=payments or _StubPaymentService(),
        storage=storage or _StubStorageService(),
    )


def test_lookup_purchase_returns_latest_completed_purchase() -> None:
    """Lookup should prioritise the newest completed purchase for a user and game."""

    _create_schema()
    with session_scope() as session:
        buyer = User(pubkey_hex="buyer-lookup")
        session.add(buyer)
        session.flush()

        _, developer = _create_developer(session)
        game = _create_game(session, developer=developer)

        first = Purchase(
            user_id=buyer.id,
            game_id=game.id,
            invoice_id="hash111",
            invoice_status=InvoiceStatus.EXPIRED,
            amount_msats=5_000,
        )
        session.add(first)
        session.flush()
        first.created_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
        first.updated_at = first.created_at

        latest = Purchase(
            user_id=buyer.id,
            game_id=game.id,
            invoice_id="hash222",
            invoice_status=InvoiceStatus.PAID,
            amount_msats=5_000,
            download_granted=True,
        )
        session.add(latest)
        session.flush()
        latest.created_at = datetime(2024, 1, 2, tzinfo=timezone.utc)
        latest.updated_at = latest.created_at

        service = _build_service(session)
        result = service.lookup_purchase(
            game_id=game.id,
            user_id=buyer.id,
            anon_id=None,
        )

        assert result.id == latest.id


def test_lookup_purchase_requires_identifier() -> None:
    """Lookup should reject calls without a user or anonymous identifier."""

    _create_schema()
    with session_scope() as session:
        service = _build_service(session)
        with pytest.raises(MissingLookupIdentifierError):
            service.lookup_purchase(game_id="missing", user_id=None, anon_id=None)


def test_lookup_purchase_supports_guest_identifier() -> None:
    """Guest lookups should resolve a stored guest account before querying purchases."""

    _create_schema()
    with session_scope() as session:
        guest = User(pubkey_hex="anon:guest-lookup", display_name="Guest Player")
        session.add(guest)
        session.flush()

        _, developer = _create_developer(session)
        game = _create_game(session, developer=developer)

        purchase = Purchase(
            user_id=guest.id,
            game_id=game.id,
            invoice_id="hash333",
            invoice_status=InvoiceStatus.PAID,
            amount_msats=5_000,
            download_granted=True,
        )
        session.add(purchase)
        session.flush()

        service = _build_service(session)
        result = service.lookup_purchase(
            game_id=game.id,
            user_id=None,
            anon_id="guest-lookup",
        )

        assert result.id == purchase.id
        assert result.user_id == guest.id


def test_reconcile_lnbits_webhook_marks_purchase_paid() -> None:
    """Webhook reconciliation should mark the purchase as paid and grant downloads."""

    _create_schema()
    payments = _StubPaymentService()
    payments.status_responses["hash123"] = ProviderInvoiceStatus(
        paid=True,
        pending=False,
        amount_msats=6_000,
    )

    with session_scope() as session:
        buyer = User(pubkey_hex="buyer-webhook")
        session.add(buyer)
        session.flush()

        _, developer = _create_developer(session)
        game = _create_game(session, developer=developer, build_object_key="game.zip")

        purchase = Purchase(
            user_id=buyer.id,
            game_id=game.id,
            invoice_id="hash123",
            invoice_status=InvoiceStatus.PENDING,
            amount_msats=5_000,
        )
        session.add(purchase)
        session.flush()

        service = _build_service(session, payments=payments)
        processed = service.reconcile_lnbits_webhook(invoice_id="hash123")

        assert processed is True
        session.refresh(purchase)
        assert purchase.invoice_status is InvoiceStatus.PAID
        assert purchase.download_granted is True
        assert purchase.amount_msats == 6_000
        assert purchase.paid_at is not None


def test_reconcile_lnbits_webhook_returns_false_for_unknown_invoice() -> None:
    """Webhook reconciliation should ignore invoices that do not map to purchases."""

    _create_schema()
    with session_scope() as session:
        service = _build_service(session)
        assert service.reconcile_lnbits_webhook(invoice_id="missing") is False


def test_create_download_link_records_audit_log() -> None:
    """Creating a download link should persist an audit record and return the link."""

    _create_schema()
    storage = _StubStorageService()

    with session_scope() as session:
        buyer = User(pubkey_hex="buyer-download")
        session.add(buyer)
        session.flush()

        _, developer = _create_developer(session)
        game = _create_game(
            session,
            developer=developer,
            build_object_key="games/build.zip",
        )

        purchase = Purchase(
            user_id=buyer.id,
            game_id=game.id,
            invoice_id="hash777",
            invoice_status=InvoiceStatus.PAID,
            amount_msats=5_000,
            download_granted=True,
        )
        session.add(purchase)
        session.flush()

        service = _build_service(session, storage=storage)
        result = service.create_download_link(purchase_id=purchase.id, user_id=buyer.id)

        assert result.download.url == storage.response.url
        assert storage.object_keys == ["games/build.zip"]

        log = session.scalar(select(DownloadAuditLog))
        assert log is not None
        assert log.purchase_id == purchase.id
        assert log.user_id == buyer.id


def test_create_download_link_rejects_invalid_purchase_state() -> None:
    """Download links should only be generated for paid purchases with granted access."""

    _create_schema()
    with session_scope() as session:
        buyer = User(pubkey_hex="buyer-download-invalid")
        session.add(buyer)
        session.flush()

        _, developer = _create_developer(session)
        game = _create_game(session, developer=developer, build_object_key="games/build.zip")

        purchase = Purchase(
            user_id=buyer.id,
            game_id=game.id,
            invoice_id="hash888",
            invoice_status=InvoiceStatus.PENDING,
            amount_msats=5_000,
            download_granted=False,
        )
        session.add(purchase)
        session.flush()

        service = _build_service(session)
        with pytest.raises(PurchaseNotDownloadableError):
            service.create_download_link(purchase_id=purchase.id, user_id=buyer.id)

        purchase.invoice_status = InvoiceStatus.PAID
        purchase.download_granted = True
        game.build_object_key = None
        session.flush()

        with pytest.raises(PurchaseBuildUnavailableError):
            service.create_download_link(purchase_id=purchase.id, user_id=buyer.id)


def test_request_refund_marks_purchase_requested() -> None:
    """Requesting a refund should flip the purchase refund state to requested."""

    _create_schema()
    with session_scope() as session:
        buyer = User(pubkey_hex="buyer-refund")
        session.add(buyer)
        session.flush()

        _, developer = _create_developer(session)
        game = _create_game(session, developer=developer)

        purchase = Purchase(
            user_id=buyer.id,
            game_id=game.id,
            invoice_id="hash999",
            invoice_status=InvoiceStatus.PAID,
            amount_msats=5_000,
            download_granted=True,
        )
        session.add(purchase)
        session.flush()

        service = _build_service(session)
        updated = service.request_refund(purchase_id=purchase.id, user_id=buyer.id)

        assert updated.refund_requested is True
        assert updated.refund_status is RefundStatus.REQUESTED


def test_request_refund_enforces_ownership_and_status() -> None:
    """Refund requests should validate ownership and existing refund transitions."""

    _create_schema()
    with session_scope() as session:
        owner = User(pubkey_hex="buyer-owner")
        session.add(owner)
        session.flush()

        stranger = User(pubkey_hex="buyer-stranger")
        session.add(stranger)
        session.flush()

        _, developer = _create_developer(session)
        game = _create_game(session, developer=developer)

        purchase = Purchase(
            user_id=owner.id,
            game_id=game.id,
            invoice_id="hash555",
            invoice_status=InvoiceStatus.PAID,
            amount_msats=5_000,
            download_granted=True,
        )
        session.add(purchase)
        session.flush()

        service = _build_service(session)

        with pytest.raises(PurchasePermissionError):
            service.request_refund(purchase_id=purchase.id, user_id=stranger.id)

        purchase.invoice_status = InvoiceStatus.PENDING
        session.flush()

        with pytest.raises(PurchaseNotRefundableError):
            service.request_refund(purchase_id=purchase.id, user_id=owner.id)

        purchase.invoice_status = InvoiceStatus.PAID
        purchase.refund_status = RefundStatus.DENIED
        session.flush()

        with pytest.raises(PurchaseNotRefundableError):
            service.request_refund(purchase_id=purchase.id, user_id=owner.id)
