"""Domain services orchestrating purchase lifecycle operations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import (
    DownloadAuditLog,
    InvoiceStatus,
    Purchase,
    RefundStatus,
)
from proof_of_play_api.services.game_promotion import (
    maybe_promote_game_to_discover,
    update_game_featured_status,
)
from proof_of_play_api.services.guest_checkout import (
    GuestCheckoutError,
    GuestCheckoutService,
    get_guest_checkout_service,
)
from proof_of_play_api.services.payments import (
    PaymentService,
    PaymentServiceError,
    get_payment_service,
)
from proof_of_play_api.services.storage import (
    PresignedDownload,
    StorageService,
    get_storage_service,
)


class PurchaseWorkflowError(RuntimeError):
    """Base error raised when purchase workflow operations fail validation."""

    def __init__(self, detail: str, *, status_code: int) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


class MissingLookupIdentifierError(PurchaseWorkflowError):
    """Raised when a purchase lookup omits both user and anon identifiers."""

    def __init__(self) -> None:
        super().__init__(
            "Provide user_id or anon_id to look up purchases.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class GuestLookupError(PurchaseWorkflowError):
    """Raised when resolving a guest identifier fails validation."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail, status_code=status.HTTP_400_BAD_REQUEST)


class PurchaseNotFoundError(PurchaseWorkflowError):
    """Raised when the referenced purchase record cannot be located."""

    def __init__(self) -> None:
        super().__init__("Purchase not found.", status_code=status.HTTP_404_NOT_FOUND)


class PurchasePermissionError(PurchaseWorkflowError):
    """Raised when a user attempts to act on a purchase they do not own."""

    def __init__(self) -> None:
        super().__init__(
            "You do not have permission to access this purchase.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class PurchaseNotDownloadableError(PurchaseWorkflowError):
    """Raised when a purchase is not yet eligible for download access."""

    def __init__(self) -> None:
        super().__init__(
            "Purchase is not eligible for download.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class PurchaseBuildUnavailableError(PurchaseWorkflowError):
    """Raised when the associated game lacks a downloadable build."""

    def __init__(self) -> None:
        super().__init__(
            "Game build is not available for download.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class PurchaseNotRefundableError(PurchaseWorkflowError):
    """Raised when a purchase fails the prerequisites for requesting a refund."""

    def __init__(self, detail: str = "Only paid purchases can be refunded.") -> None:
        super().__init__(detail, status_code=status.HTTP_400_BAD_REQUEST)


class PaymentProviderUnavailableError(PurchaseWorkflowError):
    """Raised when the Lightning provider returns an error response."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail, status_code=status.HTTP_502_BAD_GATEWAY)


@dataclass(slots=True)
class PurchaseDownloadResult:
    """Value object describing a generated download link for a purchase."""

    purchase: Purchase
    download: PresignedDownload


@dataclass(slots=True)
class PurchaseWorkflowService:
    """Encapsulate purchase lifecycle transitions and lookups."""

    session: Session
    guest_checkout: GuestCheckoutService
    payments: PaymentService
    storage: StorageService

    def lookup_purchase(
        self,
        *,
        game_id: str,
        user_id: str | None,
        anon_id: str | None,
    ) -> Purchase:
        """Return the newest purchase matching the provided identifiers."""

        lookup_user_id = user_id
        if lookup_user_id is None:
            if anon_id is None:
                raise MissingLookupIdentifierError()
            try:
                guest_user = self.guest_checkout.get_guest_user(anon_id=anon_id)
            except GuestCheckoutError as exc:
                raise GuestLookupError(str(exc)) from exc
            if guest_user is None:
                raise PurchaseNotFoundError()
            lookup_user_id = guest_user.id

        order_by_columns = (Purchase.created_at.desc(), Purchase.id.desc())
        completed_stmt = (
            select(Purchase)
            .where(
                Purchase.game_id == game_id,
                Purchase.user_id == lookup_user_id,
                or_(
                    Purchase.download_granted.is_(True),
                    Purchase.invoice_status == InvoiceStatus.PAID,
                ),
            )
            .order_by(*order_by_columns)
            .limit(1)
        )
        purchase = self.session.scalars(completed_stmt).first()
        if purchase is None:
            fallback_stmt = (
                select(Purchase)
                .where(Purchase.game_id == game_id, Purchase.user_id == lookup_user_id)
                .order_by(*order_by_columns)
                .limit(1)
            )
            purchase = self.session.scalars(fallback_stmt).first()
        if purchase is None:
            raise PurchaseNotFoundError()
        return purchase

    def reconcile_lnbits_webhook(self, *, invoice_id: str) -> bool:
        """Update purchase state using the latest LNbits invoice information."""

        purchase = self.session.scalar(
            select(Purchase).where(Purchase.invoice_id == invoice_id)
        )
        if purchase is None:
            return False

        try:
            status_info = self.payments.get_invoice_status(invoice_id=invoice_id)
        except PaymentServiceError as exc:
            raise PaymentProviderUnavailableError(str(exc)) from exc

        if status_info.paid:
            purchase.invoice_status = InvoiceStatus.PAID
            purchase.download_granted = True
            if purchase.paid_at is None:
                purchase.paid_at = datetime.now(timezone.utc)
            if status_info.amount_msats is not None:
                purchase.amount_msats = status_info.amount_msats
        elif not status_info.pending and purchase.invoice_status is InvoiceStatus.PENDING:
            purchase.invoice_status = InvoiceStatus.EXPIRED

        self.session.flush()

        if status_info.paid and purchase.game is not None:
            game = purchase.game
            promoted = maybe_promote_game_to_discover(session=self.session, game=game)
            featured_changed, _ = update_game_featured_status(
                session=self.session,
                game=game,
            )
            if promoted or featured_changed:
                self.session.flush()

        return True

    def create_download_link(
        self,
        *,
        purchase_id: str,
        user_id: str,
    ) -> PurchaseDownloadResult:
        """Return a pre-signed download URL for a paid purchase."""

        purchase = self.session.get(Purchase, purchase_id)
        if purchase is None:
            raise PurchaseNotFoundError()

        if purchase.user_id != user_id:
            raise PurchasePermissionError()

        if purchase.invoice_status is not InvoiceStatus.PAID or not purchase.download_granted:
            raise PurchaseNotDownloadableError()

        game = purchase.game
        if game is None or not game.build_object_key:
            raise PurchaseBuildUnavailableError()

        download = self.storage.create_presigned_download(
            object_key=game.build_object_key
        )

        audit_log = DownloadAuditLog(
            purchase_id=purchase.id,
            user_id=purchase.user_id,
            game_id=game.id,
            object_key=game.build_object_key,
            expires_at=download.expires_at,
        )
        self.session.add(audit_log)
        self.session.flush()

        return PurchaseDownloadResult(purchase=purchase, download=download)

    def request_refund(self, *, purchase_id: str, user_id: str) -> Purchase:
        """Flag a paid purchase for refund review."""

        purchase = self.session.get(Purchase, purchase_id)
        if purchase is None:
            raise PurchaseNotFoundError()

        if purchase.user_id != user_id:
            raise PurchasePermissionError()

        if purchase.invoice_status is not InvoiceStatus.PAID:
            raise PurchaseNotRefundableError()

        if purchase.refund_status in {RefundStatus.PAID, RefundStatus.DENIED}:
            raise PurchaseNotRefundableError(
                "This purchase is not eligible for a new refund request."
            )

        purchase.refund_requested = True
        purchase.refund_status = RefundStatus.REQUESTED
        self.session.flush()

        return purchase


def get_purchase_workflow_service(
    session: Session = Depends(get_session),
    guest_checkout: GuestCheckoutService = Depends(get_guest_checkout_service),
    payments: PaymentService = Depends(get_payment_service),
    storage: StorageService = Depends(get_storage_service),
) -> PurchaseWorkflowService:
    """Return a request-scoped purchase workflow service instance."""

    return PurchaseWorkflowService(
        session=session,
        guest_checkout=guest_checkout,
        payments=payments,
        storage=storage,
    )


__all__ = [
    "GuestLookupError",
    "MissingLookupIdentifierError",
    "PaymentProviderUnavailableError",
    "PurchaseBuildUnavailableError",
    "PurchaseDownloadResult",
    "PurchaseNotDownloadableError",
    "PurchaseNotFoundError",
    "PurchaseNotRefundableError",
    "PurchasePermissionError",
    "PurchaseWorkflowError",
    "PurchaseWorkflowService",
    "get_purchase_workflow_service",
]
