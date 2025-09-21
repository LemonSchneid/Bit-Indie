"""Endpoints for listing and creating game comments."""

from __future__ import annotations

import json
import logging
from json import JSONDecodeError

from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from proof_of_play_api.core.config import get_settings
from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import Game
from proof_of_play_api.schemas.comment import CommentCreateRequest, CommentRead
from proof_of_play_api.services.comment_thread import CommentThreadService
from proof_of_play_api.services.comment_workflow import (
    CommentRateLimitExceeded,
    CommentWorkflow,
    GameNotFoundError,
    InvalidProofOfWorkError,
    UserNotFoundError,
)


router = APIRouter(prefix="/v1/games/{game_id}/comments", tags=["comments"])
logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _build_comment_thread_service() -> CommentThreadService:
    """Instantiate the comment thread service used across requests."""

    settings = get_settings()
    return CommentThreadService(nostr_enabled=settings.nostr_enabled)


def get_comment_thread_service() -> CommentThreadService:
    """Provide the shared comment thread service for API handlers."""

    return _build_comment_thread_service()


def get_comment_workflow(
    comment_thread_service: CommentThreadService = Depends(get_comment_thread_service),
) -> CommentWorkflow:
    """Provide a workflow coordinator using the configured thread service."""

    return CommentWorkflow(comment_thread_service=comment_thread_service)


async def get_raw_comment_body(request: Request) -> str | None:
    """Return the unnormalized comment body from the incoming JSON payload."""

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
def list_game_comments(
    game_id: str,
    session: Session = Depends(get_session),
    comment_thread_service: CommentThreadService = Depends(get_comment_thread_service),
) -> list[CommentRead]:
    """Return all comments for the requested game ordered by creation time."""

    game = session.get(Game, game_id)
    if game is None or not game.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    service = comment_thread_service
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
    workflow: CommentWorkflow = Depends(get_comment_workflow),
    raw_body_md: str | None = Depends(get_raw_comment_body),
    session: Session = Depends(get_session),
) -> CommentRead:
    """Persist a comment authored by the requesting user on the specified game."""

    try:
        dto = workflow.create_comment(
            session=session,
            game_id=game_id,
            request=request,
            raw_body_md=raw_body_md,
        )
    except GameNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found.",
        ) from error
    except UserNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        ) from error
    except InvalidProofOfWorkError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except CommentRateLimitExceeded as error:
        logger.info(
            "comment_rate_limit_triggered",
            extra={
                "user_id": request.user_id,
                "game_id": game_id,
                "retry_after_seconds": error.retry_after_seconds,
            },
        )
        headers: dict[str, str] | None = None
        if error.retry_after_seconds is not None:
            headers = {"Retry-After": str(error.retry_after_seconds)}
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Comment rate limit exceeded. Please wait before posting again.",
            headers=headers,
        ) from error

    return CommentRead.model_validate(dto)

__all__ = [
    "create_game_comment",
    "get_comment_thread_service",
    "get_comment_workflow",
    "get_raw_comment_body",
    "list_game_comments",
]
