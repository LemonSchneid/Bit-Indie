"""Administrative endpoints for managing refund payouts."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from proof_of_play_api.api.v1.routes.admin import require_admin_user
from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import (
    InvoiceStatus,
    Purchase,
    RefundPayout,
    RefundStatus,
)
from proof_of_play_api.schemas.purchase import (
    PurchaseRead,
    RefundPayoutCreate,
    RefundPayoutRead,
    RefundPayoutResponse,
)
from proof_of_play_api.services.game_promotion import update_game_featured_status


router = APIRouter(prefix="/v1/admin/refunds", tags=["admin"])


@router.post(
    "/{purchase_id}",
    response_model=RefundPayoutResponse,
    summary="Record a manual refund payout",
)
def record_refund_payout(
    purchase_id: str,
    request: RefundPayoutCreate,
    session: Session = Depends(get_session),
) -> RefundPayoutResponse:
    """Allow administrators to mark a purchase as refunded and log payout details."""

    admin = require_admin_user(session=session, user_id=request.user_id)

    purchase = session.get(Purchase, purchase_id)
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found.")

    if purchase.invoice_status is not InvoiceStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only paid purchases can be refunded.",
        )

    if purchase.refund_status is RefundStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This purchase has already been refunded.",
        )

    amount_msats = request.amount_msats
    if amount_msats is None:
        amount_msats = purchase.amount_msats

    payout = RefundPayout(
        purchase_id=purchase.id,
        processed_by_id=admin.id,
        amount_msats=amount_msats,
        payment_reference=request.payment_reference,
        notes=request.notes,
    )
    session.add(payout)

    purchase.refund_requested = True
    purchase.refund_status = RefundStatus.PAID
    purchase.invoice_status = InvoiceStatus.REFUNDED
    purchase.download_granted = False
    session.flush()

    game = purchase.game
    if game is not None:
        changed, _ = update_game_featured_status(session=session, game=game)
        if changed:
            session.flush()

    return RefundPayoutResponse(
        purchase=PurchaseRead.model_validate(purchase),
        payout=RefundPayoutRead.model_validate(payout),
    )


__all__ = ["record_refund_payout"]
