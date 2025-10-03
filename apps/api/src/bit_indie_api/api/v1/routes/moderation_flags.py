"""Player-facing moderation flag submission endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

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
    ModerationFlagCreateRequest,
    ModerationFlagRead,
)
from bit_indie_api.services.rate_limiting import (
    FLAG_RATE_LIMIT_MAX_ITEMS,
    FLAG_RATE_LIMIT_WINDOW_SECONDS,
    RateLimitExceeded,
    enforce_rate_limit,
)


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/moderation/flags", tags=["moderation"])


_TARGET_MODEL_MAP = {
    ModerationTargetType.GAME: Game,
    ModerationTargetType.COMMENT: Comment,
    ModerationTargetType.REVIEW: Review,
}


def _ensure_target_exists(*, session: Session, target_type: ModerationTargetType, target_id: str) -> None:
    """Raise an HTTP 404 error when the provided moderation target cannot be located."""

    model = _TARGET_MODEL_MAP.get(target_type)
    if model is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Unsupported moderation target type.")

    if session.get(model, target_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Moderation target not found.")


@router.post(
    "",
    response_model=ModerationFlagRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a moderation flag",
)
def create_moderation_flag(
    request: ModerationFlagCreateRequest,
    response: Response,
    session: Session = Depends(get_session),
) -> ModerationFlagRead:
    """Persist a moderation flag for games, comments, or reviews."""

    user = session.get(User, request.user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Reporting user not found.")

    _ensure_target_exists(
        session=session, target_type=request.target_type, target_id=request.target_id
    )

    existing_flag_stmt = (
        select(ModerationFlag)
        .where(ModerationFlag.user_id == user.id)
        .where(ModerationFlag.target_type == request.target_type)
        .where(ModerationFlag.target_id == request.target_id)
        .where(ModerationFlag.status == ModerationFlagStatus.OPEN)
        .limit(1)
    )
    existing_flag = session.scalar(existing_flag_stmt)
    if existing_flag is not None:
        response.status_code = status.HTTP_200_OK
        return ModerationFlagRead.model_validate(existing_flag)

    try:
        enforce_rate_limit(
            session=session,
            model=ModerationFlag,
            user_id=user.id,
            window_seconds=FLAG_RATE_LIMIT_WINDOW_SECONDS,
            max_items=FLAG_RATE_LIMIT_MAX_ITEMS,
            action="create_moderation_flag",
            resource_id=request.target_id,
        )
    except RateLimitExceeded as error:
        logger.info(
            "moderation_flag_rate_limit_triggered",
            extra={
                "user_id": user.id,
                "target_type": request.target_type,
                "target_id": request.target_id,
                "retry_after_seconds": error.retry_after_seconds,
            },
        )
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Flag submission rate limit exceeded. Please wait before reporting again.",
            headers={"Retry-After": str(error.retry_after_seconds)},
        ) from error

    flag = ModerationFlag(
        user_id=user.id,
        target_type=request.target_type,
        target_id=request.target_id,
        reason=request.reason,
    )
    session.add(flag)
    session.flush()
    session.refresh(flag)

    return ModerationFlagRead.model_validate(flag)


__all__ = ["create_moderation_flag"]

