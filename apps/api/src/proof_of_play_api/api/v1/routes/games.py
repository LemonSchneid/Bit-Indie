"""Endpoints for managing game draft creation and updates."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import AnyUrl
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import Developer, Game, GameStatus, InvoiceStatus, Purchase, User
from proof_of_play_api.schemas.game import (
    GameCreateRequest,
    FeaturedGameSummary,
    GamePublishChecklist,
    GamePublishRequest,
    GamePublishRequirement,
    GameRead,
    GameUpdateRequest,
    PublishRequirementCode,
)
from proof_of_play_api.schemas.purchase import (
    InvoiceCreateRequest,
    InvoiceCreateResponse,
)
from proof_of_play_api.schemas.storage import (
    GameAssetUploadRequest,
    GameAssetUploadResponse,
)
from proof_of_play_api.services.storage import (
    GameAssetKind,
    StorageService,
    get_storage_service,
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


router = APIRouter(prefix="/v1/games", tags=["games"])


def _get_developer_id(*, session: Session, user_id: str) -> str:
    """Return the developer identifier for the given user or raise an HTTP error."""

    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    developer = user.developer_profile
    if developer is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must have a developer profile to manage games.",
        )

    return developer.id


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
) -> InvoiceCreateResponse:
    """Create a purchase record and Lightning invoice for the requested game."""

    user = session.get(User, invoice_request.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

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
    webhook_url = f"{base_url}/v1/purchases/lnbits/webhook"
    memo = f"Proof of Play - {game.title}"

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
        invoice_id=invoice.invoice_id,
        payment_request=invoice.payment_request,
        amount_msats=price_msats,
        invoice_status=purchase.invoice_status,
        check_url=check_url,
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
) -> GameRead:
    """Persist a new game draft for the requesting developer."""

    developer_id = _get_developer_id(session=session, user_id=request.user_id)

    existing_slug = session.scalar(select(Game).where(Game.slug == request.slug))
    if existing_slug is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A game with this slug already exists.",
        )

    payload = request.model_dump(exclude={"user_id"})
    game = Game(developer_id=developer_id, active=False, **payload)
    session.add(game)
    session.flush()
    session.refresh(game)

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
) -> GameRead:
    """Update a game draft owned by the requesting developer."""

    developer_id = _get_developer_id(session=session, user_id=request.user_id)

    game = session.get(Game, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    if game.developer_id != developer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this game.",
        )

    updates = request.model_dump(exclude_unset=True, exclude={"user_id"})

    new_slug = updates.get("slug")
    if new_slug and new_slug != game.slug:
        slug_conflict = session.scalar(select(Game).where(Game.slug == new_slug))
        if slug_conflict is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A game with this slug already exists.",
            )

    new_build_key = updates.get("build_object_key")
    if new_build_key and not new_build_key.startswith(f"games/{game.id}/build/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Build object key is invalid for this game.",
        )

    for field, value in updates.items():
        if isinstance(value, AnyUrl):
            value = str(value)
        setattr(game, field, value)

    session.flush()
    session.refresh(game)

    changed, _ = update_game_featured_status(session=session, game=game)
    if changed:
        session.flush()
        session.refresh(game)

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
) -> GameAssetUploadResponse:
    """Return a pre-signed upload payload for a developer owned game asset."""

    developer_id = _get_developer_id(session=session, user_id=request.user_id)

    game = session.get(Game, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    if game.developer_id != developer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this game.",
        )

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


def _evaluate_publish_requirements(game: Game) -> list[GamePublishRequirement]:
    """Return any unmet requirements blocking a game from being published."""

    missing: list[GamePublishRequirement] = []

    if not (game.summary and game.summary.strip()):
        missing.append(
            GamePublishRequirement(
                code=PublishRequirementCode.SUMMARY,
                message="Add a short summary before publishing.",
            )
        )

    if not (game.description_md and game.description_md.strip()):
        missing.append(
            GamePublishRequirement(
                code=PublishRequirementCode.DESCRIPTION,
                message="Provide a longer description to help players understand the game.",
            )
        )

    if not game.cover_url:
        missing.append(
            GamePublishRequirement(
                code=PublishRequirementCode.COVER_IMAGE,
                message="Upload a cover image to showcase the game on its listing page.",
            )
        )

    build_requirements = (
        game.build_object_key,
        game.build_size_bytes,
        game.checksum_sha256,
    )
    if not all(build_requirements):
        missing.append(
            GamePublishRequirement(
                code=PublishRequirementCode.BUILD_UPLOAD,
                message="Upload a downloadable build with size and checksum recorded.",
            )
        )

    return missing


@router.get(
    "/{game_id}/publish-checklist",
    response_model=GamePublishChecklist,
    summary="List remaining requirements before a game can be published",
)
def get_publish_checklist(
    game_id: str,
    user_id: str,
    session: Session = Depends(get_session),
) -> GamePublishChecklist:
    """Return the outstanding publish requirements for the caller's game draft."""

    developer_id = _get_developer_id(session=session, user_id=user_id)

    game = session.get(Game, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    if game.developer_id != developer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this checklist.",
        )

    missing = _evaluate_publish_requirements(game)

    return GamePublishChecklist(is_publish_ready=not missing, missing_requirements=missing)


@router.post(
    "/{game_id}/publish",
    response_model=GameRead,
    summary="Publish a game listing as unlisted once requirements are met",
)
def publish_game(
    game_id: str,
    request: GamePublishRequest,
    session: Session = Depends(get_session),
) -> GameRead:
    """Promote a game draft to the unlisted catalog if all requirements are satisfied."""

    developer_id = _get_developer_id(session=session, user_id=request.user_id)

    game = session.get(Game, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    if game.developer_id != developer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to publish this game.",
        )

    missing = _evaluate_publish_requirements(game)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Game is missing required fields for publishing.",
                "missing_requirements": [item.model_dump() for item in missing],
            },
        )

    game.active = True
    game.status = GameStatus.UNLISTED

    session.flush()
    session.refresh(game)

    changed, _ = update_game_featured_status(session=session, game=game)
    if changed:
        session.flush()
        session.refresh(game)

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
    "list_featured_games",
    "create_game_asset_upload",
    "create_game_draft",
    "create_game_invoice",
    "get_publish_checklist",
    "publish_game",
    "read_game_by_slug",
    "update_game_draft",
]
