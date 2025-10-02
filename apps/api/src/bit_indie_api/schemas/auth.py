"""Pydantic models for authentication and session management endpoints."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from bit_indie_api.schemas.user import UserRead


class AccountSignupRequest(BaseModel):
    """Request payload for creating a first-party account."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str | None = Field(None, min_length=1, max_length=120)


class AccountLoginRequest(BaseModel):
    """Request payload for authenticating with email and password."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class AccountSessionResponse(BaseModel):
    """Response body containing the authenticated user and session token."""

    user: UserRead
    session_token: str = Field(..., min_length=10)

    model_config = ConfigDict(from_attributes=True)


__all__ = [
    "AccountLoginRequest",
    "AccountSessionResponse",
    "AccountSignupRequest",
]
