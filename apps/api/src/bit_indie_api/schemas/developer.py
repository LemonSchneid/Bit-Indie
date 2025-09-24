"""Schemas describing developer profile payloads."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class DeveloperCreateRequest(BaseModel):
    """Payload for promoting a user to developer status."""

    user_id: str
    profile_url: str | None = None
    contact_email: EmailStr | None = None


class DeveloperRead(BaseModel):
    """Serialized view of a developer profile."""

    id: str
    user_id: str
    verified_dev: bool
    profile_url: str | None
    contact_email: EmailStr | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


__all__ = ["DeveloperCreateRequest", "DeveloperRead"]

