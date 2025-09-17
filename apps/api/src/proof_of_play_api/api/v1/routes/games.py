"""Endpoints for managing game draft creation and updates."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import Game, User
from proof_of_play_api.schemas.game import GameCreateRequest, GameRead, GameUpdateRequest


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
    game = Game(developer_id=developer_id, **payload)
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

    for field, value in updates.items():
        setattr(game, field, value)

    session.flush()
    session.refresh(game)
    return GameRead.model_validate(game)


__all__ = ["create_game_draft", "update_game_draft"]
