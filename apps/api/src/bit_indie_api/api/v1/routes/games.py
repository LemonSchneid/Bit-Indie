"""Endpoints for managing game draft creation and updates."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from bit_indie_api.db import get_session
from bit_indie_api.db.models import Developer, Game, GameStatus, InvoiceStatus, Purchase, User
from bit_indie_api.schemas.game import (
    GameCreateRequest,
    FeaturedGameSummary,
    GamePublishChecklist,
    GamePublishRequest,
    GameRead,
    GameUpdateRequest,
)
from bit_indie_api.schemas.purchase import (
    InvoiceCreateRequest,
    InvoiceCreateResponse,
)
from bit_indie_api.schemas.storage import (
    GameAssetUploadRequest,
    GameAssetUploadResponse,
)
from bit_indie_api.services.storage import (
    GameAssetKind,
    StorageService,
    get_storage_service,
)
from bit_indie_api.services.game_drafting import (
    GameDraftingError,
    GameDraftingService,
    PublishChecklistResult,
    get_game_drafting_service,
)
from bit_indie_api.services.game_publication import (
    GamePublicationService,
    get_game_publication_service,
)
from bit_indie_api.services.game_promotion import update_game_featured_status
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
from bit_indie_api.services.nostr_publisher import (
    ReleaseNotePublishError,
    ReleaseNotePublisher,
    get_release_note_publisher,
)


router = APIRouter(prefix="/v1/games", tags=["games"])


@router.get(
    "",
    response_model=list[GameRead],
    summary="List publicly visible games in the catalog",
)
def list_catalog_games(session: Session = Depends(get_session)) -> list[GameRead]:
    """Return active games that are visible on the public storefront."""

    stmt = (
        select(Game)
        .options(joinedload(Game.developer).joinedload(Developer.user))
        .where(Game.active.is_(True))
        .where(Game.status.in_([GameStatus.DISCOVER, GameStatus.FEATURED]))
        .order_by(Game.updated_at.desc())
    )
    games = session.scalars(stmt).all()

    return [GameRead.model_validate(game) for game in games]


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


@router.post(
    "",
    response_model=GameRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new game draft",
)
def create_game_draft(
    request: GameCreateRequest,
    session: Session = Depends(get_session),
    drafting: GameDraftingService = Depends(get_game_drafting_service),
) -> GameRead:
    """Persist a new game draft for the requesting developer."""

    try:
        game = drafting.create_draft(session=session, request=request)
    except GameDraftingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return GameRead.model_validate(game)


@router.put(
    "/{game_id}",
    response_model=GameRead,
    summary="Update an existing game draft",
)
def update_game_draft(
    game_id: str,
    request: GameUpdateRequest,
    session: Session = Depends(get_session),
    drafting: GameDraftingService = Depends(get_game_drafting_service),
) -> GameRead:
    """Update a game draft owned by the requesting developer."""

    try:
        game = drafting.update_draft(
            session=session,
            game_id=game_id,
            request=request,
        )
    except GameDraftingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return GameRead.model_validate(game)


@router.post(
    "/{game_id}/uploads/{asset}",
    response_model=GameAssetUploadResponse,
    summary="Generate a pre-signed upload for a game asset",
)
def create_game_asset_upload(
    game_id: str,
    asset: GameAssetKind,
    request: GameAssetUploadRequest,
    session: Session = Depends(get_session),
    storage: StorageService = Depends(get_storage_service),
    drafting: GameDraftingService = Depends(get_game_drafting_service),
) -> GameAssetUploadResponse:
    """Return a pre-signed upload payload for a developer owned game asset."""

    try:
        drafting.authorize_game_access(
            session=session, user_id=request.user_id, game_id=game_id
        )
    except GameDraftingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    upload = storage.generate_game_asset_upload(
        game_id=game_id,
        asset=asset,
        filename=request.filename,
        content_type=request.content_type,
        max_bytes=request.max_bytes,
    )

    return GameAssetUploadResponse(
        upload_url=upload.upload_url,
        fields=upload.fields,
        object_key=upload.object_key,
        public_url=upload.public_url,
    )


@router.get(
    "/{game_id}/publish-checklist",
    response_model=GamePublishChecklist,
    summary="List remaining requirements before a game can be published",
)
def get_publish_checklist(
    game_id: str,
    user_id: str,
    session: Session = Depends(get_session),
    drafting: GameDraftingService = Depends(get_game_drafting_service),
) -> GamePublishChecklist:
    """Return the outstanding publish requirements for the caller's game draft."""

    try:
        result: PublishChecklistResult = drafting.get_publish_checklist(
            session=session,
            user_id=user_id,
            game_id=game_id,
        )
    except GameDraftingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return result.checklist


@router.post(
    "/{game_id}/publish",
    response_model=GameRead,
    summary="Publish a game listing as unlisted once requirements are met",
)
def publish_game(
    game_id: str,
    request: GamePublishRequest,
    session: Session = Depends(get_session),
    publisher: ReleaseNotePublisher = Depends(get_release_note_publisher),
    publication: GamePublicationService = Depends(get_game_publication_service),
    drafting: GameDraftingService = Depends(get_game_drafting_service),
) -> GameRead:
    """Promote a game draft to the unlisted catalog if all requirements are satisfied."""

    try:
        game = drafting.publish_game(
            session=session,
            game_id=game_id,
            request=request,
            publisher=publisher,
            publication=publication,
        )
    except GameDraftingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ReleaseNotePublishError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return GameRead.model_validate(game)


@router.get(
    "/slug/{slug}",
    response_model=GameRead,
    summary="Retrieve a published game by its slug",
)
def read_game_by_slug(slug: str, session: Session = Depends(get_session)) -> GameRead:
    """Return a published game that is accessible via direct URL lookup."""

    normalized_slug = slug.strip().lower()
    if not normalized_slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug cannot be empty.")

    stmt = (
        select(Game)
        .options(joinedload(Game.developer).joinedload(Developer.user))
        .where(Game.slug == normalized_slug, Game.active.is_(True))
    )
    game = session.scalar(stmt)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    return GameRead.model_validate(game)


@router.get(
    "/featured",
    response_model=list[FeaturedGameSummary],
    summary="List games eligible for the featured rotation",
)
def list_featured_games(
    limit: int = Query(
        default=6,
        ge=1,
        le=12,
        description="Maximum number of featured games to return in the rotation.",
    ),
    session: Session = Depends(get_session),
) -> list[FeaturedGameSummary]:
    """Return featured games along with the metrics that justify their placement."""

    reference = datetime.now(timezone.utc)
    stmt = (
        select(Game)
        .options(joinedload(Game.developer).joinedload(Developer.user))
        .where(Game.active.is_(True))
        .where(Game.status.in_([GameStatus.DISCOVER, GameStatus.FEATURED]))
        .order_by(Game.updated_at.desc())
    )
    games = session.scalars(stmt).all()

    summaries: list[FeaturedGameSummary] = []
    status_changed = False

    for game in games:
        changed, eligibility = update_game_featured_status(
            session=session, game=game, reference=reference
        )
        status_changed = status_changed or changed

        if game.status == GameStatus.FEATURED and eligibility.meets_thresholds:
            summaries.append(
                FeaturedGameSummary(
                    game=GameRead.model_validate(game),
                    verified_review_count=eligibility.verified_review_count,
                    paid_purchase_count=eligibility.paid_purchase_count,
                    refunded_purchase_count=eligibility.refunded_purchase_count,
                    refund_rate=eligibility.refund_rate,
                    updated_within_window=eligibility.updated_within_window,
                )
            )

    if status_changed:
        session.flush()

    return summaries[:limit]


__all__ = [
    "list_catalog_games",
    "list_featured_games",
    "create_game_asset_upload",
    "create_game_draft",
    "create_game_invoice",
    "get_publish_checklist",
    "publish_game",
    "read_game_by_slug",
    "update_game_draft",
]
