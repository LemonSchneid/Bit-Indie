"""Pydantic models describing comment payloads and responses."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from proof_of_play_api.schemas.security import ProofOfWorkSubmission


class CommentCreateRequest(BaseModel):
    """Request body for creating a comment on a game listing."""

    user_id: str
    body_md: str = Field(..., min_length=1, max_length=10_000)
    proof_of_work: ProofOfWorkSubmission | None = None

    @field_validator("body_md")
    @classmethod
    def _strip_body(cls, value: str) -> str:
        """Normalize comment bodies by stripping surrounding whitespace."""

        normalized = value.strip()
        if not normalized:
            msg = "Comment body cannot be empty."
            raise ValueError(msg)
        return normalized


class CommentRead(BaseModel):
    """Serialized representation of a game comment."""

    id: str
    game_id: str
    user_id: str
    body_md: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


__all__ = ["CommentCreateRequest", "CommentRead"]

