from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from bit_indie_api.db import get_session
from bit_indie_api.schemas.game import (
    GameCreateRequest,
    GamePublishChecklist,
    GamePublishRequest,
    GameRead,
    GameUpdateRequest,
)
from bit_indie_api.schemas.storage import (
    GameAssetUploadRequest,
    GameAssetUploadResponse,
)
from bit_indie_api.services.game_drafting import (
    GameDraftingError,
    GameDraftingService,
    PublishChecklistResult,
    get_game_drafting_service,
)
from bit_indie_api.services.game_publication import (
    GamePublicationService,
    get_game_publication_service,
)
from bit_indie_api.services.storage import (
    GameAssetKind,
    StorageService,
    get_storage_service,
)

router = APIRouter(prefix="/v1/games", tags=["game-drafts"])


@router.post(
    "",
    response_model=GameRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new game draft",
)
def create_game_draft(
    request: GameCreateRequest,
    session: Session = Depends(get_session),
    drafting: GameDraftingService = Depends(get_game_drafting_service),
) -> GameRead:
    """Persist a new game draft for the requesting developer."""

    try:
        game = drafting.create_draft(session=session, request=request)
    except GameDraftingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

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
    drafting: GameDraftingService = Depends(get_game_drafting_service),
) -> GameRead:
    """Apply updates to the authenticated developer's game draft."""

    try:
        game = drafting.update_draft(
            session=session,
            game_id=game_id,
            request=request,
        )
    except GameDraftingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

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
    drafting: GameDraftingService = Depends(get_game_drafting_service),
) -> GameAssetUploadResponse:
    """Return a pre-signed upload payload for a developer owned game asset."""

    try:
        drafting.authorize_game_access(
            session=session, user_id=request.user_id, game_id=game_id
        )
    except GameDraftingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

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


@router.get(
    "/{game_id}/publish-checklist",
    response_model=GamePublishChecklist,
    summary="List remaining requirements before a game can be published",
)
def get_publish_checklist(
    game_id: str,
    user_id: str,
    session: Session = Depends(get_session),
    drafting: GameDraftingService = Depends(get_game_drafting_service),
) -> GamePublishChecklist:
    """Return the outstanding publish requirements for the caller's game draft."""

    try:
        result: PublishChecklistResult = drafting.get_publish_checklist(
            session=session,
            user_id=user_id,
            game_id=game_id,
        )
    except GameDraftingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return result.checklist


@router.post(
    "/{game_id}/publish",
    response_model=GameRead,
    summary="Publish a game listing as unlisted once requirements are met",
)
def publish_game(
    game_id: str,
    request: GamePublishRequest,
    session: Session = Depends(get_session),
    publication: GamePublicationService = Depends(get_game_publication_service),
    drafting: GameDraftingService = Depends(get_game_drafting_service),
) -> GameRead:
    """Promote a game draft to the unlisted catalog if all requirements are satisfied."""

    try:
        game = drafting.publish_game(
            session=session,
            game_id=game_id,
            request=request,
            publication=publication,
        )
    except GameDraftingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return GameRead.model_validate(game)


__all__ = [
    "create_game_asset_upload",
    "create_game_draft",
    "get_publish_checklist",
    "publish_game",
    "router",
    "update_game_draft",
]
