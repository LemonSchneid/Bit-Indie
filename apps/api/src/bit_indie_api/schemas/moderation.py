"""Schema definitions for admin moderation workflows."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from bit_indie_api.db.models import (
    GameStatus,
    ModerationFlagReason,
    ModerationFlagStatus,
    ModerationTargetType,
)


class ModerationReporter(BaseModel):
    """Minimal profile details for the user who reported content."""

    id: str
    account_identifier: str
    display_name: str | None


class FlaggedGameSummary(BaseModel):
    """Condensed representation of a flagged game listing."""

    id: str
    title: str
    slug: str
    status: GameStatus
    active: bool

    model_config = ConfigDict(from_attributes=True)


class FlaggedCommentSummary(BaseModel):
    """Details about a comment that triggered a moderation flag."""

    id: str
    game_id: str
    user_id: str
    body_md: str
    created_at: datetime
    is_hidden: bool

    model_config = ConfigDict(from_attributes=True)


class FlaggedReviewSummary(BaseModel):
    """Details about a review surfaced in the moderation queue."""

    id: str
    game_id: str
    user_id: str
    title: str | None
    body_md: str
    rating: int | None
    helpful_score: float
    created_at: datetime
    is_hidden: bool

    model_config = ConfigDict(from_attributes=True)


class ModerationQueueItem(BaseModel):
    """Single entry within the admin moderation queue."""

    id: str
    target_type: ModerationTargetType
    target_id: str
    reason: ModerationFlagReason
    status: ModerationFlagStatus
    created_at: datetime
    reporter: ModerationReporter
    game: FlaggedGameSummary | None = None
    comment: FlaggedCommentSummary | None = None
    review: FlaggedReviewSummary | None = None


class ModerationTakedownRequest(BaseModel):
    """Administrative action request to remove or hide flagged content."""

    user_id: str = Field(..., description="Identifier of the acting admin user.")
    target_type: ModerationTargetType
    target_id: str


class ModerationActionResponse(BaseModel):
    """Outcome of applying a moderation takedown."""

    target_type: ModerationTargetType
    target_id: str
    applied_status: ModerationFlagStatus
    affected_flag_ids: list[str] = Field(default_factory=list)


class ModerationFlagCreateRequest(BaseModel):
    """Player-submitted report targeting games, comments, or reviews."""

    user_id: str = Field(..., description="Identifier of the reporting user.")
    target_type: ModerationTargetType
    target_id: str
    reason: ModerationFlagReason


class ModerationFlagRead(BaseModel):
    """Details about a moderation flag stored in the system."""

    id: str
    target_type: ModerationTargetType
    target_id: str
    reason: ModerationFlagReason
    status: ModerationFlagStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ModerationRestoreRequest(BaseModel):
    """Administrative request to restore hidden moderated content."""

    user_id: str = Field(..., description="Identifier of the acting admin user.")
    target_type: ModerationTargetType
    target_id: str


class HiddenModerationItem(BaseModel):
    """Details about hidden comments and reviews awaiting potential restoration."""

    target_type: ModerationTargetType
    target_id: str
    created_at: datetime
    game: FlaggedGameSummary
    comment: FlaggedCommentSummary | None = None
    review: FlaggedReviewSummary | None = None


__all__ = [
    "FlaggedCommentSummary",
    "FlaggedGameSummary",
    "FlaggedReviewSummary",
    "HiddenModerationItem",
    "ModerationActionResponse",
    "ModerationFlagCreateRequest",
    "ModerationFlagRead",
    "ModerationQueueItem",
    "ModerationReporter",
    "ModerationRestoreRequest",
    "ModerationTakedownRequest",
]
