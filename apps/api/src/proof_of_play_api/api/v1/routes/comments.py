"""Endpoints for listing and creating game comments."""

from __future__ import annotations

import json
import logging
from json import JSONDecodeError

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import Comment, Game, User
from proof_of_play_api.schemas.comment import CommentCreateRequest, CommentRead
from proof_of_play_api.services.proof_of_work import (
    ProofOfWorkValidationError,
    enforce_proof_of_work,
)
from proof_of_play_api.services.rate_limiting import (
    COMMENT_RATE_LIMIT_MAX_ITEMS,
    COMMENT_RATE_LIMIT_WINDOW_SECONDS,
    RateLimitExceeded,
    enforce_rate_limit,
)
from proof_of_play_api.services.comment_thread import CommentThreadService


router = APIRouter(prefix="/v1/games/{game_id}/comments", tags=["comments"])
logger = logging.getLogger(__name__)

_comment_thread_service = CommentThreadService()


def get_comment_thread_service() -> CommentThreadService:
    """Return the singleton comment thread service used by API handlers."""

    return _comment_thread_service


async def _extract_raw_body_md(request: Request) -> str | None:
    """Return the untrimmed comment body from the incoming JSON payload."""

    try:
        body_bytes = await request.body()
    except RuntimeError:
        return None
    if not body_bytes:
        return None

    try:
        payload = json.loads(body_bytes)
    except JSONDecodeError:
        return None

    body_md = payload.get("body_md")
    if isinstance(body_md, str):
        return body_md
    return None


@router.get(
    "",
    response_model=list[CommentRead],
    summary="List comments for a game",
)
def list_game_comments(game_id: str, session: Session = Depends(get_session)) -> list[CommentRead]:
    """Return all comments for the requested game ordered by creation time."""

    game = session.get(Game, game_id)
    if game is None or not game.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    service = get_comment_thread_service()
    dtos = service.list_for_game(session=session, game=game)
    return [CommentRead.model_validate(dto) for dto in dtos]


@router.post(
    "",
    response_model=CommentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new comment on a game",
)
def create_game_comment(
    game_id: str,
    request: CommentCreateRequest,
    raw_body_md: str | None = Depends(_extract_raw_body_md),
    session: Session = Depends(get_session),
) -> CommentRead:
    """Persist a comment authored by the requesting user on the specified game."""

    game = session.get(Game, game_id)
    if game is None or not game.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    user = session.get(User, request.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    pow_payload = raw_body_md if raw_body_md is not None else request.body_md

    try:
        enforce_proof_of_work(
            user=user,
            resource_id=f"comment:{game_id}",
            payload=pow_payload,
            proof=request.proof_of_work,
        )
    except ProofOfWorkValidationError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    try:
        enforce_rate_limit(
            session=session,
            model=Comment,
            user_id=user.id,
            window_seconds=COMMENT_RATE_LIMIT_WINDOW_SECONDS,
            max_items=COMMENT_RATE_LIMIT_MAX_ITEMS,
            action="create_comment",
            resource_id=game_id,
        )
    except RateLimitExceeded as error:
        logger.info(
            "comment_rate_limit_triggered",
            extra={
                "user_id": user.id,
                "game_id": game_id,
                "retry_after_seconds": error.retry_after_seconds,
            },
        )
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Comment rate limit exceeded. Please wait before posting again.",
            headers={"Retry-After": str(error.retry_after_seconds)},
        ) from error

    comment = Comment(game_id=game_id, user_id=user.id, body_md=request.body_md)
    comment.user = user
    session.add(comment)
    session.flush()
    session.refresh(comment)

    service = get_comment_thread_service()
    dto = service.serialize_comment(session=session, comment=comment)
    return CommentRead.model_validate(dto)


__all__ = ["create_game_comment", "list_game_comments"]

