"""Pydantic schemas for the authentication endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Sequence

from pydantic import BaseModel, ConfigDict, Field, field_validator

from bit_indie_api.schemas.user import UserRead


def _validate_hex(value: str, field_name: str) -> str:
    """Ensure a string is valid hexadecimal."""

    try:
        bytes.fromhex(value)
    except ValueError as exc:  # pragma: no cover - defensive
        raise ValueError(f"{field_name} must be a hex-encoded string.") from exc
    return value


class NostrEvent(BaseModel):
    """Signed event produced by a NIP-07 capable Nostr client."""

    id: str = Field(..., description="Event hash computed from the payload.")
    pubkey: str = Field(..., description="32-byte hex encoded public key.")
    created_at: int = Field(..., description="Unix timestamp when the event was signed.")
    kind: int = Field(..., description="Event kind identifier.")
    tags: Sequence[Sequence[str]] = Field(..., description="List of tags included in the event.")
    content: str = Field(..., description="Event content as provided by the client.")
    sig: str = Field(..., description="64-byte hex encoded Schnorr signature.")

    model_config = ConfigDict(arbitrary_types_allowed=False)

    @field_validator("id")
    @classmethod
    def _ensure_id_hex(cls, value: str) -> str:
        return _validate_hex(value, "id")

    @field_validator("pubkey")
    @classmethod
    def _ensure_pubkey_hex(cls, value: str) -> str:
        return _validate_hex(value, "pubkey")

    @field_validator("sig")
    @classmethod
    def _ensure_signature_hex(cls, value: str) -> str:
        return _validate_hex(value, "sig")


class LoginChallengeResponse(BaseModel):
    """Response returned when issuing a new login challenge."""

    challenge: str
    issued_at: datetime
    expires_at: datetime


class LoginVerifyRequest(BaseModel):
    """Request payload containing a signed login event."""

    event: NostrEvent


class LoginSuccessResponse(BaseModel):
    """Response payload when a login attempt succeeds."""

    user: UserRead
    session_token: str

