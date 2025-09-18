"""Schema definitions for admin moderation workflows."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from proof_of_play_api.db.models import (
    GameStatus,
    ModerationFlagReason,
    ModerationFlagStatus,
    ModerationTargetType,
)


class ModerationReporter(BaseModel):
    """Minimal profile details for the user who reported content."""

    id: str
    pubkey_hex: str
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
    total_zap_msats: int
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


__all__ = [
    "FlaggedCommentSummary",
    "FlaggedGameSummary",
    "FlaggedReviewSummary",
    "ModerationActionResponse",
    "ModerationQueueItem",
    "ModerationReporter",
    "ModerationTakedownRequest",
]
