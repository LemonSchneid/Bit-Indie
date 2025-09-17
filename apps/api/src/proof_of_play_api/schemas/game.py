"""Pydantic models describing game draft payloads and responses."""

from __future__ import annotations

import enum
from datetime import datetime

from pydantic import AnyUrl, BaseModel, ConfigDict, Field, field_validator

from proof_of_play_api.db.models import GameCategory, GameStatus


class GameBase(BaseModel):
    """Shared fields for creating and updating game drafts."""

    title: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=200)
    summary: str | None = Field(default=None, max_length=280)
    description_md: str | None = None
    price_msats: int | None = Field(default=None, ge=0)
    cover_url: AnyUrl | None = None
    trailer_url: AnyUrl | None = None
    category: GameCategory = GameCategory.PROTOTYPE

    @field_validator("slug")
    @classmethod
    def _validate_slug(cls, value: str) -> str:
        """Ensure the slug only contains URL-safe characters."""

        allowed = set("abcdefghijklmnopqrstuvwxyz0123456789-")
        normalized = value.strip().lower()
        if not normalized:
            msg = "Slug cannot be empty."
            raise ValueError(msg)
        if any(char not in allowed for char in normalized):
            msg = "Slug may only include lowercase letters, numbers, and hyphens."
            raise ValueError(msg)
        return normalized


class GameCreateRequest(GameBase):
    """Request payload for creating a new game draft."""

    user_id: str


class GameUpdateRequest(BaseModel):
    """Request payload for updating an existing game draft."""

    user_id: str
    title: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = Field(default=None, max_length=280)
    description_md: str | None = None
    price_msats: int | None = Field(default=None, ge=0)
    cover_url: AnyUrl | None = None
    trailer_url: AnyUrl | None = None
    category: GameCategory | None = None
    build_object_key: str | None = Field(default=None, min_length=1, max_length=500)
    build_size_bytes: int | None = Field(default=None, ge=0)
    checksum_sha256: str | None = Field(default=None, min_length=64, max_length=64)

    @field_validator("slug")
    @classmethod
    def _validate_slug(cls, value: str | None) -> str | None:
        """Normalize provided slug values."""

        if value is None:
            return None
        allowed = set("abcdefghijklmnopqrstuvwxyz0123456789-")
        normalized = value.strip().lower()
        if not normalized:
            msg = "Slug cannot be empty."
            raise ValueError(msg)
        if any(char not in allowed for char in normalized):
            msg = "Slug may only include lowercase letters, numbers, and hyphens."
            raise ValueError(msg)
        return normalized

    @field_validator("checksum_sha256")
    @classmethod
    def _normalize_checksum(cls, value: str | None) -> str | None:
        """Ensure checksum values are lowercase hexadecimal strings."""

        if value is None:
            return None
        normalized = value.strip().lower()
        if len(normalized) != 64 or any(char not in "0123456789abcdef" for char in normalized):
            msg = "Checksum must be a 64 character hexadecimal string."
            raise ValueError(msg)
        return normalized


class GameRead(BaseModel):
    """Serialized representation of a stored game draft."""

    id: str
    developer_id: str
    status: GameStatus
    title: str
    slug: str
    summary: str | None
    description_md: str | None
    price_msats: int | None
    cover_url: AnyUrl | None
    trailer_url: AnyUrl | None
    category: GameCategory
    build_object_key: str | None
    build_size_bytes: int | None
    checksum_sha256: str | None
    active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublishRequirementCode(str, enum.Enum):
    """Identifiers for the requirements needed to publish a game."""

    SUMMARY = "SUMMARY"
    DESCRIPTION = "DESCRIPTION"
    COVER_IMAGE = "COVER_IMAGE"
    BUILD_UPLOAD = "BUILD_UPLOAD"


class GamePublishRequirement(BaseModel):
    """A single unmet requirement blocking a game from being published."""

    code: PublishRequirementCode
    message: str


class GamePublishChecklist(BaseModel):
    """Missing publish requirements for a game and overall readiness."""

    is_publish_ready: bool
    missing_requirements: list[GamePublishRequirement] = Field(default_factory=list)


class GamePublishRequest(BaseModel):
    """Request payload for promoting a game draft to the unlisted state."""

    user_id: str


__all__ = [
    "GameCreateRequest",
    "GamePublishChecklist",
    "GamePublishRequest",
    "GamePublishRequirement",
    "GameRead",
    "GameUpdateRequest",
    "PublishRequirementCode",
]
