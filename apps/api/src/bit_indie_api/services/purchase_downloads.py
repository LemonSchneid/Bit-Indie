"""Helpers for generating purchase download links and audit logs."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from bit_indie_api.db.models import DownloadAuditLog, InvoiceStatus, Purchase
from bit_indie_api.services.purchase_errors import (
    PurchaseBuildUnavailableError,
    PurchaseNotDownloadableError,
)
from bit_indie_api.services.storage import PresignedDownload, StorageService


@dataclass(slots=True)
class PurchaseDownloadManager:
    """Generate presigned downloads and audit purchase access."""

    session: Session
    storage: StorageService

    def ensure_downloadable(self, purchase: Purchase) -> None:
        """Validate that ``purchase`` is eligible for download access."""

        if purchase.invoice_status is not InvoiceStatus.PAID or not purchase.download_granted:
            raise PurchaseNotDownloadableError()

    def create_download(
        self,
        *,
        purchase: Purchase,
    ) -> PresignedDownload:
        """Create a presigned download URL and record an audit entry."""

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

        return download


__all__ = ["PurchaseDownloadManager"]
