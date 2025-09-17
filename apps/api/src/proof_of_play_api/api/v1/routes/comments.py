"""Endpoints for listing and creating game comments."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import Comment, Game, User
from proof_of_play_api.schemas.comment import CommentCreateRequest, CommentRead


router = APIRouter(prefix="/v1/games/{game_id}/comments", tags=["comments"])


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

    stmt = select(Comment).where(Comment.game_id == game_id).order_by(Comment.created_at.asc())
    comments = session.scalars(stmt).all()
    return [CommentRead.model_validate(comment) for comment in comments]


@router.post(
    "",
    response_model=CommentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new comment on a game",
)
def create_game_comment(
    game_id: str,
    request: CommentCreateRequest,
    session: Session = Depends(get_session),
) -> CommentRead:
    """Persist a comment authored by the requesting user on the specified game."""

    game = session.get(Game, game_id)
    if game is None or not game.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    user = session.get(User, request.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    comment = Comment(game_id=game_id, user_id=user.id, body_md=request.body_md)
    session.add(comment)
    session.flush()
    session.refresh(comment)

    return CommentRead.model_validate(comment)


__all__ = ["create_game_comment", "list_game_comments"]

