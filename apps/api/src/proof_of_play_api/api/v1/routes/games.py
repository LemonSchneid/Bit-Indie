"""Endpoints for managing game draft creation and updates."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import Game, GameStatus, User
from proof_of_play_api.schemas.game import (
    GameCreateRequest,
    GamePublishChecklist,
    GamePublishRequest,
    GamePublishRequirement,
    GameRead,
    GameUpdateRequest,
    PublishRequirementCode,
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
        setattr(game, field, value)

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

    stmt = select(Game).where(Game.slug == normalized_slug, Game.active.is_(True))
    game = session.scalar(stmt)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    return GameRead.model_validate(game)


__all__ = [
    "create_game_asset_upload",
    "create_game_draft",
    "get_publish_checklist",
    "publish_game",
    "read_game_by_slug",
    "update_game_draft",
]
