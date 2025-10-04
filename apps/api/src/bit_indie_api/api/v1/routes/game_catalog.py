from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from bit_indie_api.db import get_session
from bit_indie_api.db.models import Developer, Game, GameStatus
from bit_indie_api.schemas.game import (
    FeaturedGameSummary,
    GameRead,
)
from bit_indie_api.services.game_promotion import update_game_featured_status

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
                    verified_comment_count=eligibility.verified_comment_count,
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
    "read_game_by_slug",
    "router",
]
