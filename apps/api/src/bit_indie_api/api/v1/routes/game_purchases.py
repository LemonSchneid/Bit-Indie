from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from bit_indie_api.api.security import require_authenticated_user_id
from bit_indie_api.db import get_session
from bit_indie_api.db.models import Game, InvoiceStatus, Purchase, User
from bit_indie_api.schemas.purchase import (
    InvoiceCreateRequest,
    InvoiceCreateResponse,
)
from bit_indie_api.services.guest_checkout import (
    GuestCheckoutError,
    GuestCheckoutService,
    get_guest_checkout_service,
)
from bit_indie_api.services.payments import (
    PaymentService,
    PaymentServiceError,
    get_payment_service,
)
from bit_indie_api.services.purchase_workflow import (
    PurchaseWorkflowError,
    PurchaseWorkflowService,
    get_purchase_workflow_service,
)

router = APIRouter(prefix="/v1/games", tags=["game-purchases"])


@router.post(
    "/{game_id}/invoice",
    response_model=InvoiceCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Lightning invoice for purchasing a game",
)
def create_game_invoice(
    game_id: str,
    invoice_request: InvoiceCreateRequest,
    http_request: Request,
    session: Session = Depends(get_session),
    payments: PaymentService = Depends(get_payment_service),
    guest_checkout: GuestCheckoutService = Depends(get_guest_checkout_service),
) -> InvoiceCreateResponse:
    """Create a purchase record and Lightning invoice for the requested game."""

    user: User | None = None
    if invoice_request.user_id:
        user = session.get(User, invoice_request.user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    elif invoice_request.anon_id:
        try:
            user = guest_checkout.ensure_guest_user(anon_id=invoice_request.anon_id)
        except GuestCheckoutError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if user is None:  # pragma: no cover - defensive guard, validator ensures one id present
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User information missing.")

    game = session.get(Game, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    if not game.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game is not available for purchase.",
        )

    price_msats = game.price_msats
    if price_msats is None or price_msats <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game does not have a price configured for purchase.",
        )
    if price_msats % 1000 != 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game price must be divisible by 1,000 milli-satoshis.",
        )

    base_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{base_url}/v1/purchases/opennode/webhook"
    memo = f"Bit Indie - {game.title}"

    try:
        invoice = payments.create_invoice(
            amount_msats=price_msats,
            memo=memo,
            webhook_url=webhook_url,
        )
    except PaymentServiceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    purchase = Purchase(
        user_id=user.id,
        game_id=game_id,
        invoice_id=invoice.invoice_id,
        invoice_status=InvoiceStatus.PENDING,
        amount_msats=price_msats,
    )
    session.add(purchase)
    session.flush()
    session.refresh(purchase)

    check_url = str(http_request.url_for("read_purchase", purchase_id=purchase.id))
    return InvoiceCreateResponse(
        purchase_id=purchase.id,
        user_id=user.id,
        invoice_id=invoice.invoice_id,
        payment_request=invoice.payment_request,
        amount_msats=price_msats,
        invoice_status=purchase.invoice_status,
        check_url=check_url,
        hosted_checkout_url=invoice.hosted_checkout_url,
    )


@router.get(
    "/{game_id}/download",
    summary="Redirect to a signed download link for the authenticated buyer",
    status_code=status.HTTP_307_TEMPORARY_REDIRECT,
)
def download_game_build(
    game_id: str,
    authenticated_user_id: str = Depends(require_authenticated_user_id),
    workflow: PurchaseWorkflowService = Depends(get_purchase_workflow_service),
) -> RedirectResponse:
    """Return a temporary redirect to a presigned download link for the game build."""

    try:
        purchase = workflow.lookup_purchase(
            game_id=game_id,
            user_id=authenticated_user_id,
            anon_id=None,
        )
        result = workflow.create_download_link(
            purchase_id=purchase.id,
            user_id=authenticated_user_id,
        )
    except PurchaseWorkflowError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    response = RedirectResponse(
        url=result.download.url,
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Download-Expires-At"] = result.download.expires_at.isoformat()
    return response


__all__ = [
    "create_game_invoice",
    "download_game_build",
    "router",
]
