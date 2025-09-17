"""Endpoints dealing with purchase status and payment provider webhooks."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import InvoiceStatus, Purchase
from proof_of_play_api.schemas.purchase import LnBitsWebhookPayload, PurchaseRead
from proof_of_play_api.services.payments import (
    PaymentService,
    PaymentServiceError,
    get_payment_service,
)


router = APIRouter(prefix="/v1/purchases", tags=["purchases"])


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
    return {"status": "ok"}


__all__ = [
    "handle_lnbits_webhook",
    "read_purchase",
]
