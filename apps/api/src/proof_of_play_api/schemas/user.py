"""User-facing schema representations for API responses."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserRead(BaseModel):
    """Serialized view of a marketplace user."""

    id: str
    pubkey_hex: str
    display_name: str | None
    nip05: str | None
    reputation_score: int
    is_admin: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


__all__ = ["UserRead"]

