"""Reusable dependencies that enforce authenticated API access."""

from __future__ import annotations

from typing import Annotated

from fastapi import Header, HTTPException, status

from bit_indie_api.core.config import get_settings
from bit_indie_api.services.session_tokens import (
    ExpiredSessionTokenError,
    InvalidSessionTokenError,
    decode_session_token,
)


def require_authenticated_user_id(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None
) -> str:
    """Return the user identifier embedded in a valid session token."""

    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication is required.")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication is required.")

    settings = get_settings()
    try:
        claims = decode_session_token(token=token, secret=settings.session_secret)
    except ExpiredSessionTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has expired.") from None
    except InvalidSessionTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.") from None

    return claims.user_id


__all__ = ["require_authenticated_user_id"]
