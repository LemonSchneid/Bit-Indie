"""Pydantic models describing comment payloads and responses."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from proof_of_play_api.schemas.security import ProofOfWorkSubmission
from proof_of_play_api.services.comment_thread import CommentSource


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


class CommentAuthor(BaseModel):
    """Public-facing metadata for a comment author."""

    user_id: str | None
    pubkey_hex: str | None
    npub: str | None
    display_name: str | None
    lightning_address: str | None

    model_config = ConfigDict(from_attributes=True)


class CommentRead(BaseModel):
    """Serialized representation of a game comment."""

    id: str
    game_id: str
    body_md: str
    created_at: datetime
    source: CommentSource
    author: CommentAuthor
    is_verified_purchase: bool
    total_zap_msats: int

    model_config = ConfigDict(from_attributes=True)


__all__ = ["CommentAuthor", "CommentCreateRequest", "CommentRead"]
