"""Pydantic models describing review creation and serialization."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewCreateRequest(BaseModel):
    """Request body for submitting a review on a game listing."""

    user_id: str
    body_md: str = Field(..., min_length=1, max_length=20_000)
    title: str | None = Field(default=None, max_length=200)
    rating: int | None = Field(default=None, ge=1, le=5)

    @field_validator("body_md")
    @classmethod
    def _strip_body(cls, value: str) -> str:
        """Normalize review bodies by stripping surrounding whitespace."""

        normalized = value.strip()
        if not normalized:
            msg = "Review body cannot be empty."
            raise ValueError(msg)
        return normalized


class ReviewRead(BaseModel):
    """Serialized representation of a stored game review."""

    id: str
    game_id: str
    user_id: str
    title: str | None
    body_md: str
    rating: int | None
    helpful_score: float
    is_verified_purchase: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


__all__ = ["ReviewCreateRequest", "ReviewRead"]

