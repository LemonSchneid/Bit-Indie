"""Domain services orchestrating purchase lifecycle operations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from bit_indie_api.db import get_session
from bit_indie_api.db.models import InvoiceStatus, Purchase, RefundStatus
from bit_indie_api.services.game_promotion import (
    maybe_promote_game_to_discover,
    update_game_featured_status,
)
from bit_indie_api.services.guest_checkout import (
    GuestCheckoutService,
    get_guest_checkout_service,
)
from bit_indie_api.services.payments import (
    PaymentService,
    PaymentServiceError,
    get_payment_service,
)
from bit_indie_api.services.purchase_downloads import PurchaseDownloadManager
from bit_indie_api.services.purchase_errors import (
    GuestLookupError,
    MissingLookupIdentifierError,
    PaymentProviderUnavailableError,
    PurchaseBuildUnavailableError,
    PurchaseNotDownloadableError,
    PurchaseNotFoundError,
    PurchaseNotRefundableError,
    PurchasePermissionError,
    PurchaseWorkflowError,
)
from bit_indie_api.services.purchase_lookup import PurchaseLookupService
from bit_indie_api.services.purchase_payouts import RevenuePayoutManager
from bit_indie_api.services.storage import (
    PresignedDownload,
    StorageService,
    get_storage_service,
)
@dataclass(slots=True)
class PurchaseDownloadResult:
    """Value object describing a generated download link for a purchase."""

    purchase: Purchase
    download: PresignedDownload


@dataclass(slots=True)
class PurchaseWorkflowService:
    """Encapsulate purchase lifecycle transitions and lookups."""

    session: Session
    payments: PaymentService
    lookup: PurchaseLookupService
    payouts: RevenuePayoutManager
    downloads: PurchaseDownloadManager

    def _get_purchase(self, *, purchase_id: str) -> Purchase:
        """Return the stored purchase raising ``PurchaseNotFoundError`` when missing."""

        purchase = self.session.get(Purchase, purchase_id)
        if purchase is None:
            raise PurchaseNotFoundError()
        return purchase

    def _get_owned_purchase(self, *, purchase_id: str, user_id: str) -> Purchase:
        """Return the purchase owned by ``user_id`` raising if missing."""

        purchase = self._get_purchase(purchase_id=purchase_id)
        if purchase.user_id != user_id:
            raise PurchasePermissionError()
        return purchase

    def lookup_purchase(
        self,
        *,
        game_id: str,
        user_id: str | None,
        anon_id: str | None,
    ) -> Purchase:
        """Return the newest purchase matching the provided identifiers."""

        return self.lookup.lookup_purchase(
            game_id=game_id, user_id=user_id, anon_id=anon_id
        )

    def reconcile_opennode_webhook(self, *, invoice_id: str) -> bool:
        """Update purchase state using the latest OpenNode invoice information."""

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
            self.payouts.process_purchase(purchase=purchase)
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

        purchase = self._get_owned_purchase(
            purchase_id=purchase_id, user_id=user_id
        )

        self.downloads.ensure_downloadable(purchase)
        download = self.downloads.create_download(purchase=purchase)

        return PurchaseDownloadResult(purchase=purchase, download=download)

    def create_download_link_from_receipt(
        self,
        *,
        purchase_id: str,
        receipt_token: str,
    ) -> PurchaseDownloadResult:
        """Return a presigned download URL for a paid purchase using a receipt token."""

        if receipt_token.strip() != purchase_id:
            raise PurchasePermissionError()

        purchase = self._get_purchase(purchase_id=purchase_id)

        self.downloads.ensure_downloadable(purchase)
        download = self.downloads.create_download(purchase=purchase)

        return PurchaseDownloadResult(purchase=purchase, download=download)

    def request_refund(self, *, purchase_id: str, user_id: str) -> Purchase:
        """Flag a paid purchase for refund review."""

        purchase = self._get_owned_purchase(
            purchase_id=purchase_id, user_id=user_id
        )

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
        payments=payments,
        lookup=PurchaseLookupService(session=session, guest_checkout=guest_checkout),
        payouts=RevenuePayoutManager(payments=payments),
        downloads=PurchaseDownloadManager(session=session, storage=storage),
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
