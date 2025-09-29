"""Administrative moderation endpoints for the Bit Indie API."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from bit_indie_api.db import get_session
from bit_indie_api.db.models import (
    Comment,
    Game,
    ModerationFlag,
    ModerationFlagStatus,
    ModerationTargetType,
    Review,
    User,
)
from bit_indie_api.schemas.moderation import (
    FlaggedCommentSummary,
    FlaggedGameSummary,
    FlaggedReviewSummary,
    ModerationActionResponse,
    ModerationQueueItem,
    ModerationReporter,
    ModerationTakedownRequest,
)
from bit_indie_api.services.game_publication import (
    GamePublicationService,
    get_game_publication_service,
)


router = APIRouter(prefix="/v1/admin/mod", tags=["admin"])


def require_admin_user(*, session: Session, user_id: str) -> User:
    """Return the requested user when they possess admin privileges."""

    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges are required for this action.",
        )

    return user


def _serialize_flag(flag: ModerationFlag, *, session: Session) -> ModerationQueueItem:
    """Convert a moderation flag into its API representation."""

    reporter = flag.reporter
    reporter_view = ModerationReporter(
        id=reporter.id,
        account_identifier=reporter.account_identifier,
        display_name=reporter.display_name,
    )

    game_summary: FlaggedGameSummary | None = None
    comment_summary: FlaggedCommentSummary | None = None
    review_summary: FlaggedReviewSummary | None = None

    if flag.target_type is ModerationTargetType.GAME:
        game = session.get(Game, flag.target_id)
        if game is not None:
            game_summary = FlaggedGameSummary.model_validate(game)
    elif flag.target_type is ModerationTargetType.COMMENT:
        comment = session.get(Comment, flag.target_id)
        if comment is not None:
            comment_summary = FlaggedCommentSummary.model_validate(comment)
            related_game = comment.game or session.get(Game, comment.game_id)
            if related_game is not None:
                game_summary = FlaggedGameSummary.model_validate(related_game)
    elif flag.target_type is ModerationTargetType.REVIEW:
        review = session.get(Review, flag.target_id)
        if review is not None:
            review_summary = FlaggedReviewSummary.model_validate(review)
            related_game = review.game or session.get(Game, review.game_id)
            if related_game is not None:
                game_summary = FlaggedGameSummary.model_validate(related_game)

    return ModerationQueueItem(
        id=flag.id,
        target_type=flag.target_type,
        target_id=flag.target_id,
        reason=flag.reason,
        status=flag.status,
        created_at=flag.created_at,
        reporter=reporter_view,
        game=game_summary,
        comment=comment_summary,
        review=review_summary,
    )


@router.get(
    "/queue",
    response_model=list[ModerationQueueItem],
    summary="List open moderation flags",
)
def read_moderation_queue(
    user_id: str,
    session: Session = Depends(get_session),
) -> list[ModerationQueueItem]:
    """Return all open moderation flags for administrators."""

    require_admin_user(session=session, user_id=user_id)

    stmt = (
        select(ModerationFlag)
        .options(joinedload(ModerationFlag.reporter))
        .where(ModerationFlag.status == ModerationFlagStatus.OPEN)
        .order_by(ModerationFlag.created_at.asc())
    )
    flags = session.scalars(stmt).all()
    return [_serialize_flag(flag, session=session) for flag in flags]


@router.post(
    "/takedown",
    response_model=ModerationActionResponse,
    summary="Apply a takedown for flagged content",
)
def apply_moderation_takedown(
    request: ModerationTakedownRequest,
    session: Session = Depends(get_session),
    publication: GamePublicationService = Depends(get_game_publication_service),
) -> ModerationActionResponse:
    """Hide or unlist flagged content and mark associated flags as actioned."""

    require_admin_user(session=session, user_id=request.user_id)

    target_type = request.target_type
    affected_ids: list[str] = []

    if target_type is ModerationTargetType.GAME:
        game = session.get(Game, request.target_id)
        if game is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")
        publication.unpublish(session=session, game=game)
    elif target_type is ModerationTargetType.COMMENT:
        comment = session.get(Comment, request.target_id)
        if comment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found.")
        comment.is_hidden = True
    elif target_type is ModerationTargetType.REVIEW:
        review = session.get(Review, request.target_id)
        if review is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")
        review.is_hidden = True
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported moderation target.")

    session.flush()

    flag_stmt = (
        select(ModerationFlag)
        .where(ModerationFlag.target_type == target_type)
        .where(ModerationFlag.target_id == request.target_id)
        .where(ModerationFlag.status == ModerationFlagStatus.OPEN)
    )

    for flag in session.scalars(flag_stmt):
        flag.status = ModerationFlagStatus.ACTIONED
        affected_ids.append(flag.id)

    session.flush()

    return ModerationActionResponse(
        target_type=target_type,
        target_id=request.target_id,
        applied_status=ModerationFlagStatus.ACTIONED,
        affected_flag_ids=affected_ids,
    )


__all__ = [
    "apply_moderation_takedown",
    "read_moderation_queue",
    "require_admin_user",
]
