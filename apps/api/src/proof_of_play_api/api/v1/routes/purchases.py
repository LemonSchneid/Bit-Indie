"""Endpoints dealing with purchase status and payment provider webhooks."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Annotated

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import (
    DownloadAuditLog,
    InvoiceStatus,
    Purchase,
    RefundStatus,
)
from proof_of_play_api.schemas.purchase import (
    LnBitsWebhookPayload,
    PurchaseDownloadRequest,
    PurchaseDownloadResponse,
    PurchaseRead,
    PurchaseReceipt,
    PurchaseReceiptBuyer,
    PurchaseReceiptGame,
    PurchaseRefundRequest,
)
from proof_of_play_api.services.game_promotion import (
    maybe_promote_game_to_discover,
    update_game_featured_status,
)
from proof_of_play_api.services.payments import (
    PaymentService,
    PaymentServiceError,
    get_payment_service,
)
from proof_of_play_api.services.guest_checkout import (
    GuestCheckoutError,
    GuestCheckoutService,
    get_guest_checkout_service,
)
from proof_of_play_api.services.storage import StorageService, get_storage_service


router = APIRouter(prefix="/v1/purchases", tags=["purchases"])


@router.get(
    "/lookup",
    response_model=PurchaseRead,
    summary="Retrieve the most recent purchase for a user and game",
    name="lookup_purchase",
)
def lookup_purchase(
    *,
    game_id: Annotated[str, Query(min_length=1, description="Identifier of the purchased game.")],
    user_id: Annotated[
        str | None,
        Query(
            min_length=1,
            description="Identifier of the purchasing user.",
        ),
    ] = None,
    anon_id: Annotated[
        str | None,
        Query(
            min_length=1,
            description="Anonymous identifier associated with the guest purchase.",
        ),
    ] = None,
    session: Session = Depends(get_session),
    guest_checkout: GuestCheckoutService = Depends(get_guest_checkout_service),
) -> PurchaseRead:
    """Return the newest purchase matching the provided user and game identifiers."""

    lookup_user_id = user_id
    if lookup_user_id is None:
        if anon_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide user_id or anon_id to look up purchases.",
            )
        try:
            guest_user = guest_checkout.get_guest_user(anon_id=anon_id)
        except GuestCheckoutError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        if guest_user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found.")
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
    purchase = session.scalars(completed_stmt).first()
    if purchase is None:
        fallback_stmt = (
            select(Purchase)
            .where(Purchase.game_id == game_id, Purchase.user_id == lookup_user_id)
            .order_by(*order_by_columns)
            .limit(1)
        )
        purchase = session.scalars(fallback_stmt).first()
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found.")
    return PurchaseRead.model_validate(purchase)


@router.get(
    "/{purchase_id}",
    response_model=PurchaseRead,
    summary="Retrieve the current status of a purchase",
    name="read_purchase",
)
def read_purchase(purchase_id: str, session: Session = Depends(get_session)) -> PurchaseRead:
    """Return the stored purchase record for client polling."""

    purchase = session.get(Purchase, purchase_id)
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found.")
    return PurchaseRead.model_validate(purchase)


@router.get(
    "/{purchase_id}/receipt",
    response_model=PurchaseReceipt,
    summary="Retrieve purchase details for receipt rendering",
    name="read_purchase_receipt",
)
def read_purchase_receipt(
    purchase_id: str,
    session: Session = Depends(get_session),
) -> PurchaseReceipt:
    """Return a receipt payload containing purchase, buyer, and game information."""

    purchase = session.get(Purchase, purchase_id)
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found.")

    game = purchase.game
    if game is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game details are unavailable for this purchase.",
        )

    buyer = purchase.user
    if buyer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Buyer details are unavailable for this purchase.",
        )

    receipt_game = PurchaseReceiptGame(
        id=game.id,
        title=game.title,
        slug=game.slug,
        cover_url=game.cover_url,
        price_msats=game.price_msats,
        build_available=bool(game.build_object_key),
    )

    return PurchaseReceipt(
        purchase=PurchaseRead.model_validate(purchase),
        game=receipt_game,
        buyer=PurchaseReceiptBuyer.model_validate(buyer),
    )


@router.post(
    "/lnbits/webhook",
    summary="Process LNbits webhook callbacks for invoice status changes",
)
def handle_lnbits_webhook(
    payload: LnBitsWebhookPayload,
    session: Session = Depends(get_session),
    payments: PaymentService = Depends(get_payment_service),
) -> dict[str, str]:
    """Verify invoice status with LNbits and persist any state transitions."""

    purchase = session.scalar(select(Purchase).where(Purchase.invoice_id == payload.payment_hash))
    if purchase is None:
        return {"status": "ignored"}

    try:
        status_info = payments.get_invoice_status(invoice_id=payload.payment_hash)
    except PaymentServiceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    if status_info.paid:
        purchase.invoice_status = InvoiceStatus.PAID
        purchase.download_granted = True
        if purchase.paid_at is None:
            purchase.paid_at = datetime.now(timezone.utc)
        if status_info.amount_msats is not None:
            purchase.amount_msats = status_info.amount_msats
    elif not status_info.pending and purchase.invoice_status is InvoiceStatus.PENDING:
        purchase.invoice_status = InvoiceStatus.EXPIRED

    session.flush()

    if status_info.paid and purchase.game is not None:
        game = purchase.game
        promoted = maybe_promote_game_to_discover(session=session, game=game)
        featured_changed, _ = update_game_featured_status(session=session, game=game)
        if promoted or featured_changed:
            session.flush()

    return {"status": "ok"}


@router.post(
    "/{purchase_id}/download-link",
    response_model=PurchaseDownloadResponse,
    summary="Create a signed download link for a completed purchase",
)
def create_purchase_download_link(
    purchase_id: str,
    request: PurchaseDownloadRequest,
    session: Session = Depends(get_session),
    storage: StorageService = Depends(get_storage_service),
) -> PurchaseDownloadResponse:
    """Return a pre-signed download URL for a paid purchase."""

    purchase = session.get(Purchase, purchase_id)
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found.")

    if purchase.user_id != request.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this purchase.",
        )

    if purchase.invoice_status is not InvoiceStatus.PAID or not purchase.download_granted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Purchase is not eligible for download.",
        )

    game = purchase.game
    if game is None or not game.build_object_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game build is not available for download.",
        )

    download = storage.create_presigned_download(object_key=game.build_object_key)

    audit_log = DownloadAuditLog(
        purchase_id=purchase.id,
        user_id=purchase.user_id,
        game_id=game.id,
        object_key=game.build_object_key,
        expires_at=download.expires_at,
    )
    session.add(audit_log)
    session.flush()

    return PurchaseDownloadResponse(download_url=download.url, expires_at=download.expires_at)


@router.post(
    "/{purchase_id}/refund",
    response_model=PurchaseRead,
    summary="Request a refund for a completed purchase",
)
def request_purchase_refund(
    purchase_id: str,
    request: PurchaseRefundRequest,
    session: Session = Depends(get_session),
) -> PurchaseRead:
    """Mark a paid purchase as awaiting refund review."""

    purchase = session.get(Purchase, purchase_id)
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found.")

    if purchase.user_id != request.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this purchase.",
        )

    if purchase.invoice_status is not InvoiceStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only paid purchases can be refunded.",
        )

    if purchase.refund_status in {RefundStatus.PAID, RefundStatus.DENIED}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This purchase is not eligible for a new refund request.",
        )

    purchase.refund_requested = True
    purchase.refund_status = RefundStatus.REQUESTED
    session.flush()

    return PurchaseRead.model_validate(purchase)


__all__ = [
    "create_purchase_download_link",
    "handle_lnbits_webhook",
    "lookup_purchase",
    "request_purchase_refund",
    "read_purchase_receipt",
    "read_purchase",
]
