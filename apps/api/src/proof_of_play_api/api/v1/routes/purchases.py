"""Endpoints dealing with purchase status and payment provider webhooks."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Annotated

from sqlalchemy.orm import Session

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import Purchase
from proof_of_play_api.schemas.purchase import (
    OpenNodeWebhookPayload,
    PurchaseDownloadRequest,
    PurchaseDownloadResponse,
    PurchaseRead,
    PurchaseReceipt,
    PurchaseReceiptBuyer,
    PurchaseReceiptGame,
    PurchaseRefundRequest,
)
from proof_of_play_api.services.purchase_workflow import (
    PurchaseWorkflowError,
    PurchaseWorkflowService,
    get_purchase_workflow_service,
)


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
    workflow: PurchaseWorkflowService = Depends(get_purchase_workflow_service),
) -> PurchaseRead:
    """Return the newest purchase matching the provided user and game identifiers."""

    try:
        purchase = workflow.lookup_purchase(
            game_id=game_id,
            user_id=user_id,
            anon_id=anon_id,
        )
    except PurchaseWorkflowError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
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
    "/opennode/webhook",
    summary="Process OpenNode webhook callbacks for invoice status changes",
)
def handle_opennode_webhook(
    payload: OpenNodeWebhookPayload,
    workflow: PurchaseWorkflowService = Depends(get_purchase_workflow_service),
) -> dict[str, str]:
    """Verify invoice status with OpenNode and persist any state transitions."""

    try:
        processed = workflow.reconcile_opennode_webhook(invoice_id=payload.id)
    except PurchaseWorkflowError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return {"status": "ok"} if processed else {"status": "ignored"}


@router.post(
    "/{purchase_id}/download-link",
    response_model=PurchaseDownloadResponse,
    summary="Create a signed download link for a completed purchase",
)
def create_purchase_download_link(
    purchase_id: str,
    request: PurchaseDownloadRequest,
    workflow: PurchaseWorkflowService = Depends(get_purchase_workflow_service),
) -> PurchaseDownloadResponse:
    """Return a pre-signed download URL for a paid purchase."""

    try:
        result = workflow.create_download_link(
            purchase_id=purchase_id,
            user_id=request.user_id,
        )
    except PurchaseWorkflowError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return PurchaseDownloadResponse(
        download_url=result.download.url,
        expires_at=result.download.expires_at,
    )


@router.post(
    "/{purchase_id}/refund",
    response_model=PurchaseRead,
    summary="Request a refund for a completed purchase",
)
def request_purchase_refund(
    purchase_id: str,
    request: PurchaseRefundRequest,
    workflow: PurchaseWorkflowService = Depends(get_purchase_workflow_service),
) -> PurchaseRead:
    """Mark a paid purchase as awaiting refund review."""

    try:
        purchase = workflow.request_refund(
            purchase_id=purchase_id,
            user_id=request.user_id,
        )
    except PurchaseWorkflowError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return PurchaseRead.model_validate(purchase)


__all__ = [
    "create_purchase_download_link",
    "handle_opennode_webhook",
    "lookup_purchase",
    "request_purchase_refund",
    "read_purchase_receipt",
    "read_purchase",
]
