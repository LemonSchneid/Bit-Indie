"""Endpoints for listing and creating game reviews with rating gating."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import Game, InvoiceStatus, Purchase, Review, User
from proof_of_play_api.schemas.review import ReviewCreateRequest, ReviewRead
from proof_of_play_api.services.review_ranking import update_review_helpful_score


router = APIRouter(prefix="/v1/games/{game_id}/reviews", tags=["reviews"])


@router.get(
    "",
    response_model=list[ReviewRead],
    summary="List reviews for a game",
)
def list_game_reviews(game_id: str, session: Session = Depends(get_session)) -> list[ReviewRead]:
    """Return all reviews for the requested game ordered by helpful score."""

    game = session.get(Game, game_id)
    if game is None or not game.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    stmt = (
        select(Review)
        .options(joinedload(Review.user))
        .where(Review.game_id == game_id)
        .order_by(Review.helpful_score.desc(), Review.created_at.desc())
    )
    reviews = session.scalars(stmt).all()
    return [ReviewRead.model_validate(review) for review in reviews]


@router.post(
    "",
    response_model=ReviewRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new review on a game",
)
def create_game_review(
    game_id: str,
    request: ReviewCreateRequest,
    session: Session = Depends(get_session),
) -> ReviewRead:
    """Persist a review while enforcing rating gating for verified purchases."""

    game = session.get(Game, game_id)
    if game is None or not game.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    user = session.get(User, request.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    purchase_stmt = (
        select(Purchase.id)
        .where(Purchase.game_id == game_id)
        .where(Purchase.user_id == user.id)
        .where(Purchase.invoice_status == InvoiceStatus.PAID)
        .limit(1)
    )
    has_verified_purchase = session.scalar(purchase_stmt) is not None

    if request.rating is not None and not has_verified_purchase:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A rating requires a verified purchase for this game.",
        )

    review = Review(
        game_id=game_id,
        user_id=user.id,
        title=request.title,
        body_md=request.body_md,
        rating=request.rating,
        is_verified_purchase=has_verified_purchase,
    )
    review.user = user
    session.add(review)
    session.flush()
    session.refresh(review)

    update_review_helpful_score(review=review, user=user)
    session.flush()
    session.refresh(review)

    return ReviewRead.model_validate(review)


__all__ = ["create_game_review", "list_game_reviews"]

