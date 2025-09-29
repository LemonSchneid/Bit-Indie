"""User-facing schema representations for API responses."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserRead(BaseModel):
    """Serialized view of a marketplace user."""

    id: str
    account_identifier: str
    email: str | None
    display_name: str | None
    lightning_address: str | None
    reputation_score: int
    is_admin: bool
    is_developer: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserLightningAddressUpdate(BaseModel):
    """Request payload for updating a user's Lightning payout address."""

    lightning_address: str = Field(..., min_length=3, max_length=255)

    @field_validator("lightning_address")
    @classmethod
    def _validate_lightning_address(cls, value: str) -> str:
        """Ensure the address resembles a valid Lightning identifier."""

        normalized = value.strip()
        local_part, sep, domain = normalized.partition("@")
        if sep != "@" or not local_part or not domain:
            msg = "Lightning address must include a name and domain separated by '@'."
            raise ValueError(msg)
        if " " in normalized:
            msg = "Lightning address cannot contain spaces."
            raise ValueError(msg)
        return normalized


__all__ = ["UserLightningAddressUpdate", "UserRead"]

