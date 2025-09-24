"""Utilities for issuing and validating short-lived API session tokens."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone


class SessionTokenError(ValueError):
    """Base error raised when decoding a session token fails."""


class InvalidSessionTokenError(SessionTokenError):
    """Raised when a token is malformed or fails signature validation."""


class ExpiredSessionTokenError(SessionTokenError):
    """Raised when a token has exceeded its expiration timestamp."""


@dataclass(frozen=True)
class SessionTokenClaims:
    """Decoded claims extracted from a validated session token."""

    user_id: str
    issued_at: datetime
    expires_at: datetime
    nonce: str


def _urlsafe_b64encode(value: bytes) -> str:
    """Return a URL-safe base64 encoded string without padding."""

    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _urlsafe_b64decode(value: str) -> bytes:
    """Decode a URL-safe base64 string that may omit padding characters."""

    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def create_session_token(*, user_id: str, secret: str, ttl_seconds: int) -> str:
    """Return a signed token that authenticates the provided user identifier."""

    if ttl_seconds <= 0:
        msg = "Session token TTL must be greater than zero seconds."
        raise ValueError(msg)

    issued_at = int(time.time())
    payload = {
        "uid": user_id,
        "iat": issued_at,
        "exp": issued_at + ttl_seconds,
        "nonce": secrets.token_urlsafe(12),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).digest()
    return f"{_urlsafe_b64encode(payload_bytes)}.{_urlsafe_b64encode(signature)}"


def decode_session_token(*, token: str, secret: str) -> SessionTokenClaims:
    """Validate a session token and return its decoded claims."""

    try:
        payload_part, signature_part = token.split(".", 1)
    except ValueError as exc:  # pragma: no cover - defensive guardrail
        raise InvalidSessionTokenError("Session token is malformed.") from exc

    try:
        payload_bytes = _urlsafe_b64decode(payload_part)
        signature_bytes = _urlsafe_b64decode(signature_part)
    except (binascii.Error, ValueError) as exc:
        raise InvalidSessionTokenError("Session token is not valid base64.") from exc

    expected_signature = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).digest()
    if not hmac.compare_digest(signature_bytes, expected_signature):
        raise InvalidSessionTokenError("Session token signature is invalid.")

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise InvalidSessionTokenError("Session token payload is not valid JSON.") from exc

    user_id = payload.get("uid")
    issued_at = payload.get("iat")
    expires_at = payload.get("exp")
    nonce = payload.get("nonce")

    if not isinstance(user_id, str) or not user_id:
        raise InvalidSessionTokenError("Session token payload is missing a user id.")
    if not isinstance(issued_at, (int, float)) or not isinstance(expires_at, (int, float)):
        raise InvalidSessionTokenError("Session token payload contains invalid timestamps.")
    if not isinstance(nonce, str) or not nonce:
        raise InvalidSessionTokenError("Session token payload is missing a nonce.")

    now = int(time.time())
    if expires_at < now:
        raise ExpiredSessionTokenError("Session token has expired.")

    issued_dt = datetime.fromtimestamp(issued_at, tz=timezone.utc)
    expires_dt = datetime.fromtimestamp(expires_at, tz=timezone.utc)
    return SessionTokenClaims(user_id=user_id, issued_at=issued_dt, expires_at=expires_dt, nonce=nonce)


__all__ = [
    "SessionTokenClaims",
    "SessionTokenError",
    "InvalidSessionTokenError",
    "ExpiredSessionTokenError",
    "create_session_token",
    "decode_session_token",
]
