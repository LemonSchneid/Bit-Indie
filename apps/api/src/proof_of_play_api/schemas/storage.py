"""Pydantic models describing asset upload requests and responses."""

from __future__ import annotations

from pydantic import AnyHttpUrl, BaseModel, Field

from proof_of_play_api.services.storage import GameAssetKind


class GameAssetUploadRequest(BaseModel):
    """Request payload for generating a pre-signed upload for a game asset."""

    user_id: str
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str | None = Field(default=None, max_length=255)
    max_bytes: int | None = Field(default=None, gt=0)


class GameAssetUploadResponse(BaseModel):
    """Response body describing a pre-signed upload for a game asset."""

    upload_url: AnyHttpUrl
    fields: dict[str, str]
    object_key: str
    public_url: AnyHttpUrl


__all__ = ["GameAssetKind", "GameAssetUploadRequest", "GameAssetUploadResponse"]
