from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    Developer,
    DownloadAuditLog,
    Game,
    GameStatus,
    InvoiceStatus as PurchaseInvoiceStatus,
    Purchase,
    RefundStatus,
    Review,
    User,
)
from proof_of_play_api.main import create_application
from proof_of_play_api.services.payments import (
    CreatedInvoice,
    InvoiceStatus as ProviderInvoiceStatus,
    get_payment_service,
    reset_payment_service,
)
from proof_of_play_api.services.storage import PresignedDownload, get_storage_service
from sqlalchemy import select


class _StubPaymentService:
    """Test double for the payment service that records interactions."""

    def __init__(self) -> None:
        self.invoices: list[dict[str, object]] = []
        self.status_requests: list[str] = []
        self.next_invoice = CreatedInvoice(
            invoice_id="hash123",
            payment_request="lnbc2500...",
            checking_id="check123",
        )
        self.status_responses: dict[str, ProviderInvoiceStatus] = {}

    def create_invoice(self, *, amount_msats: int, memo: str, webhook_url: str) -> CreatedInvoice:
        self.invoices.append(
            {
                "amount_msats": amount_msats,
                "memo": memo,
                "webhook_url": webhook_url,
            }
        )
        return self.next_invoice

    def get_invoice_status(self, *, invoice_id: str) -> ProviderInvoiceStatus:
        self.status_requests.append(invoice_id)
        try:
            return self.status_responses[invoice_id]
        except KeyError:  # pragma: no cover - defensive guard for unexpected calls
            raise AssertionError(f"Unexpected status lookup for {invoice_id}.")


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Ensure each test runs with isolated database and payment service instances."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    reset_payment_service()
    yield
    reset_database_state()
    reset_payment_service()


def _create_schema() -> None:
    """Create ORM tables for the in-memory SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client(stub: _StubPaymentService, storage: object | None = None) -> TestClient:
    """Return a FastAPI client with the payment service dependency overridden."""

    app = create_application()
    app.dependency_overrides[get_payment_service] = lambda: stub
    if storage is not None:
        app.dependency_overrides[get_storage_service] = lambda: storage
    return TestClient(app)


def _seed_game_with_price(
    *, price_msats: int, active: bool = True, build_object_key: str | None = None
) -> tuple[str, str]:
    """Persist a user, developer, and game returning their identifiers."""

    with session_scope() as session:
        user = User(pubkey_hex="buyer-pubkey")
        session.add(user)
        session.flush()
        user_id = user.id

        developer = Developer(user_id=user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Synth Runner",
            slug="synth-runner",
            price_msats=price_msats,
            active=active,
            status=GameStatus.UNLISTED,
            build_object_key=build_object_key,
        )
        session.add(game)
        session.flush()
        game_id = game.id

    return user_id, game_id


class _StubStorageService:
    """Test double that returns a deterministic download link."""

    def __init__(self) -> None:
        self.object_keys: list[str] = []
        self.response = PresignedDownload(
            url="https://downloads.example.com/build.zip?token=abc",
            expires_at=datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc),
        )

    def create_presigned_download(self, *, object_key: str) -> PresignedDownload:
        self.object_keys.append(object_key)
        return self.response


def test_create_game_invoice_persists_purchase_and_returns_invoice() -> None:
    """Creating an invoice should call the payment service and persist the purchase."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.post(f"/v1/games/{game_id}/invoice", json={"user_id": user_id})

    assert response.status_code == 201
    body = response.json()
    assert body["invoice_id"] == "hash123"
    assert body["payment_request"] == "lnbc2500..."
    assert body["invoice_status"] == PurchaseInvoiceStatus.PENDING.value
    assert body["check_url"].endswith(f"/v1/purchases/{body['purchase_id']}")
    assert body["user_id"] == user_id
    assert stub.invoices
    assert stub.invoices[0]["amount_msats"] == 5000

    with session_scope() as session:
        purchase = session.get(Purchase, body["purchase_id"])
        assert purchase is not None
        assert purchase.invoice_id == "hash123"
        assert purchase.invoice_status is PurchaseInvoiceStatus.PENDING
        assert purchase.amount_msats == 5000
        assert purchase.refund_requested is False
        assert purchase.refund_status is RefundStatus.NONE
        assert purchase.user_id == user_id


def test_create_game_invoice_creates_guest_user_for_anon_id() -> None:
    """Guest checkout should persist a synthetic user and purchase record."""

    _create_schema()
    _, game_id = _seed_game_with_price(price_msats=5000)
    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.post(f"/v1/games/{game_id}/invoice", json={"anon_id": "guest-123"})

    assert response.status_code == 201
    body = response.json()
    assert body["user_id"]

    with session_scope() as session:
        purchase = session.get(Purchase, body["purchase_id"])
        assert purchase is not None
        assert purchase.user_id == body["user_id"]

        user = session.get(User, body["user_id"])
        assert user is not None
        assert user.pubkey_hex == "anon:guest-123"
        assert user.display_name == "Guest Player"


def test_create_game_invoice_reuses_existing_guest_user() -> None:
    """Creating multiple invoices with the same anon id should reuse the user."""

    _create_schema()
    _, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        guest = User(pubkey_hex="anon:guest-456", display_name="Guest Player")
        session.add(guest)
        session.flush()
        guest_id = guest.id

    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.post(f"/v1/games/{game_id}/invoice", json={"anon_id": "guest-456"})

    assert response.status_code == 201
    body = response.json()
    assert body["user_id"] == guest_id


def test_create_game_invoice_rejects_invalid_price() -> None:
    """Attempting to create an invoice when the price is invalid should fail."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=0)
    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.post(f"/v1/games/{game_id}/invoice", json={"user_id": user_id})

    assert response.status_code == 400


def test_create_game_invoice_rejects_blank_anon_id() -> None:
    """Guest checkout should enforce non-empty anonymous identifiers."""

    _create_schema()
    _, game_id = _seed_game_with_price(price_msats=5000)
    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.post(f"/v1/games/{game_id}/invoice", json={"anon_id": "   "})

    assert response.status_code == 400


def test_read_purchase_returns_current_state() -> None:
    """Fetching a purchase should return the stored invoice status."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash123",
            invoice_status=PurchaseInvoiceStatus.PENDING,
            amount_msats=5000,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.get(f"/v1/purchases/{purchase_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["invoice_status"] == PurchaseInvoiceStatus.PENDING.value
    assert body["amount_msats"] == 5000
    assert body["refund_requested"] is False
    assert body["refund_status"] == RefundStatus.NONE.value


def test_lookup_purchase_returns_latest_record_for_user_and_game() -> None:
    """Lookup should return the newest purchase matching the user and game."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        first = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash111",
            invoice_status=PurchaseInvoiceStatus.EXPIRED,
            amount_msats=5000,
        )
        session.add(first)
        session.flush()
        first.created_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
        first.updated_at = first.created_at
        session.flush()

        latest = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash222",
            invoice_status=PurchaseInvoiceStatus.PAID,
            amount_msats=5000,
            download_granted=True,
        )
        session.add(latest)
        session.flush()
        latest.created_at = datetime(2024, 1, 2, tzinfo=timezone.utc)
        latest.updated_at = latest.created_at
        session.flush()
        latest_id = latest.id

    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.get(f"/v1/purchases/lookup?game_id={game_id}&user_id={user_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == latest_id
    assert body["invoice_status"] == PurchaseInvoiceStatus.PAID.value
    assert body["download_granted"] is True


def test_lookup_purchase_accepts_anon_identifier() -> None:
    """Guest purchases should be retrievable using the anon id."""

    _create_schema()
    _, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        guest = User(pubkey_hex="anon:guest-lookup", display_name="Guest Player")
        session.add(guest)
        session.flush()
        guest_id = guest.id

        purchase = Purchase(
            user_id=guest_id,
            game_id=game_id,
            invoice_id="hash333",
            invoice_status=PurchaseInvoiceStatus.PAID,
            amount_msats=5000,
            download_granted=True,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.get(f"/v1/purchases/lookup?game_id={game_id}&anon_id=guest-lookup")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == purchase_id
    assert body["user_id"] == guest_id


def test_lookup_purchase_returns_404_when_no_purchase_exists() -> None:
    """Lookup should return a 404 when the user has not purchased the game."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.get(f"/v1/purchases/lookup?game_id={game_id}&user_id={user_id}")

    assert response.status_code == 404


def test_lookup_purchase_returns_404_for_unknown_guest_id() -> None:
    """Guest lookups should return 404 when the anon id has no purchases."""

    _create_schema()
    _, game_id = _seed_game_with_price(price_msats=5000)
    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.get(f"/v1/purchases/lookup?game_id={game_id}&anon_id=missing-guest")

    assert response.status_code == 404


def test_lookup_purchase_rejects_blank_anon_id() -> None:
    """Lookup should validate anonymous identifiers before querying."""

    _create_schema()
    _, game_id = _seed_game_with_price(price_msats=5000)
    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.get(f"/v1/purchases/lookup?game_id={game_id}&anon_id=   ")

    assert response.status_code == 400


def test_read_purchase_receipt_includes_related_details() -> None:
    """Receipts should include purchase, buyer, and game metadata."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        game = session.get(Game, game_id)
        assert game is not None
        game.cover_url = "https://cdn.example.com/covers/synth-runner.jpg"
        session.flush()

        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash123",
            invoice_status=PurchaseInvoiceStatus.PAID,
            amount_msats=5000,
            download_granted=True,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    stub = _StubPaymentService()
    client = _build_client(stub)

    response = client.get(f"/v1/purchases/{purchase_id}/receipt")

    assert response.status_code == 200
    body = response.json()
    assert body["purchase"]["id"] == purchase_id
    assert body["purchase"]["invoice_status"] == PurchaseInvoiceStatus.PAID.value
    assert body["purchase"]["refund_requested"] is False
    assert body["purchase"]["refund_status"] == RefundStatus.NONE.value
    assert body["game"] == {
        "id": game_id,
        "title": "Synth Runner",
        "slug": "synth-runner",
        "cover_url": "https://cdn.example.com/covers/synth-runner.jpg",
        "price_msats": 5000,
        "build_available": False,
    }
    assert body["buyer"] == {
        "id": user_id,
        "pubkey_hex": "buyer-pubkey",
        "display_name": None,
    }


def test_webhook_marks_purchase_as_paid() -> None:
    """Webhook processing should mark a purchase as paid when the provider confirms it."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash123",
            invoice_status=PurchaseInvoiceStatus.PENDING,
            amount_msats=5000,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    stub = _StubPaymentService()
    stub.status_responses["hash123"] = ProviderInvoiceStatus(paid=True, pending=False, amount_msats=5000)
    client = _build_client(stub)

    response = client.post("/v1/purchases/lnbits/webhook", json={"payment_hash": "hash123"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    with session_scope() as session:
        refreshed = session.get(Purchase, purchase_id)
        assert refreshed is not None
        assert refreshed.invoice_status is PurchaseInvoiceStatus.PAID
        assert refreshed.download_granted is True
        assert refreshed.paid_at is not None
        assert refreshed.amount_msats == 5000


def test_webhook_promotes_game_after_paid_purchase_and_review() -> None:
    """Games with a review should be promoted once a purchase is verified."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash123",
            invoice_status=PurchaseInvoiceStatus.PENDING,
            amount_msats=5000,
        )
        session.add(purchase)
        session.flush()

        reviewer = User(pubkey_hex="reviewer-pubkey")
        session.add(reviewer)
        session.flush()

        review = Review(
            game_id=game_id,
            user_id=reviewer.id,
            body_md="Solid gameplay loop",
            rating=None,
            is_verified_purchase=False,
        )
        session.add(review)
        session.flush()

        game = session.get(Game, game_id)
        assert game is not None
        assert game.status is GameStatus.UNLISTED

    stub = _StubPaymentService()
    stub.status_responses["hash123"] = ProviderInvoiceStatus(paid=True, pending=False, amount_msats=5000)
    client = _build_client(stub)

    response = client.post("/v1/purchases/lnbits/webhook", json={"payment_hash": "hash123"})

    assert response.status_code == 200

    with session_scope() as session:
        game = session.get(Game, game_id)
        assert game is not None
        assert game.status is GameStatus.DISCOVER


def test_webhook_expires_unpaid_invoice() -> None:
    """Invoices that are no longer pending and unpaid should be marked as expired."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash999",
            invoice_status=PurchaseInvoiceStatus.PENDING,
            amount_msats=5000,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    stub = _StubPaymentService()
    stub.status_responses["hash999"] = ProviderInvoiceStatus(paid=False, pending=False, amount_msats=5000)
    client = _build_client(stub)

    response = client.post("/v1/purchases/lnbits/webhook", json={"payment_hash": "hash999"})

    assert response.status_code == 200

    with session_scope() as session:
        refreshed = session.get(Purchase, purchase_id)
        assert refreshed is not None
        assert refreshed.invoice_status is PurchaseInvoiceStatus.EXPIRED
        assert refreshed.download_granted is False
        assert refreshed.paid_at is None


def test_create_download_link_returns_signed_url_and_logs_event() -> None:
    """Eligible purchases should receive a signed download link and log entry."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        game = session.get(Game, game_id)
        assert game is not None
        game.build_object_key = f"games/{game_id}/build/build.zip"
        session.flush()

        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash123",
            invoice_status=PurchaseInvoiceStatus.PAID,
            amount_msats=5000,
            download_granted=True,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    storage_stub = _StubStorageService()
    stub = _StubPaymentService()
    client = _build_client(stub, storage=storage_stub)

    response = client.post(
        f"/v1/purchases/{purchase_id}/download-link",
        json={"user_id": user_id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["download_url"] == storage_stub.response.url
    response_expires = datetime.fromisoformat(body["expires_at"].replace("Z", "+00:00"))
    assert response_expires == storage_stub.response.expires_at
    assert storage_stub.object_keys == [f"games/{game_id}/build/build.zip"]

    with session_scope() as session:
        log = session.scalar(select(DownloadAuditLog))
        assert log is not None
        assert log.purchase_id == purchase_id
        assert log.user_id == user_id
        assert log.game_id == game_id
        assert log.object_key == f"games/{game_id}/build/build.zip"
        assert log.expires_at == storage_stub.response.expires_at.replace(tzinfo=None)


def test_create_download_link_rejects_unpaid_purchase() -> None:
    """Purchases that are not fully paid should not receive download links."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        game = session.get(Game, game_id)
        assert game is not None
        game.build_object_key = f"games/{game_id}/build/build.zip"
        session.flush()

        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash123",
            invoice_status=PurchaseInvoiceStatus.PENDING,
            amount_msats=5000,
            download_granted=False,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    storage_stub = _StubStorageService()
    stub = _StubPaymentService()
    client = _build_client(stub, storage=storage_stub)

    response = client.post(
        f"/v1/purchases/{purchase_id}/download-link",
        json={"user_id": user_id},
    )

    assert response.status_code == 400
    assert storage_stub.object_keys == []

    with session_scope() as session:
        log = session.scalar(select(DownloadAuditLog))
        assert log is None


def test_create_download_link_blocks_other_users() -> None:
    """Users may only request download links for their own purchases."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        game = session.get(Game, game_id)
        assert game is not None
        game.build_object_key = f"games/{game_id}/build/build.zip"
        session.flush()

        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash123",
            invoice_status=PurchaseInvoiceStatus.PAID,
            amount_msats=5000,
            download_granted=True,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    storage_stub = _StubStorageService()
    stub = _StubPaymentService()
    client = _build_client(stub, storage=storage_stub)

    response = client.post(
        f"/v1/purchases/{purchase_id}/download-link",
        json={"user_id": "not-owner"},
    )

    assert response.status_code == 403
    assert storage_stub.object_keys == []

    with session_scope() as session:
        log = session.scalar(select(DownloadAuditLog))
        assert log is None


def test_request_refund_marks_purchase_as_requested() -> None:
    """Buyers should be able to flag a paid purchase for refund review."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash123",
            invoice_status=PurchaseInvoiceStatus.PAID,
            amount_msats=5000,
            download_granted=True,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    client = _build_client(_StubPaymentService())

    response = client.post(
        f"/v1/purchases/{purchase_id}/refund",
        json={"user_id": user_id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["refund_requested"] is True
    assert body["refund_status"] == RefundStatus.REQUESTED.value

    with session_scope() as session:
        refreshed = session.get(Purchase, purchase_id)
        assert refreshed is not None
        assert refreshed.refund_requested is True
        assert refreshed.refund_status is RefundStatus.REQUESTED


def test_request_refund_requires_purchase_owner() -> None:
    """Refund requests should only be accepted from the original buyer."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash123",
            invoice_status=PurchaseInvoiceStatus.PAID,
            amount_msats=5000,
            download_granted=True,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    client = _build_client(_StubPaymentService())

    response = client.post(
        f"/v1/purchases/{purchase_id}/refund",
        json={"user_id": "someone-else"},
    )

    assert response.status_code == 403

    with session_scope() as session:
        refreshed = session.get(Purchase, purchase_id)
        assert refreshed is not None
        assert refreshed.refund_requested is False
        assert refreshed.refund_status is RefundStatus.NONE


def test_request_refund_requires_paid_purchase() -> None:
    """Refund requests should be rejected when the invoice is not paid."""

    _create_schema()
    user_id, game_id = _seed_game_with_price(price_msats=5000)
    with session_scope() as session:
        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id="hash123",
            invoice_status=PurchaseInvoiceStatus.PENDING,
            amount_msats=5000,
            download_granted=False,
        )
        session.add(purchase)
        session.flush()
        purchase_id = purchase.id

    client = _build_client(_StubPaymentService())

    response = client.post(
        f"/v1/purchases/{purchase_id}/refund",
        json={"user_id": user_id},
    )

    assert response.status_code == 400

    with session_scope() as session:
        refreshed = session.get(Purchase, purchase_id)
        assert refreshed is not None
        assert refreshed.refund_requested is False
        assert refreshed.refund_status is RefundStatus.NONE
