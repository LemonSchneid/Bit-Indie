"""Unit tests for the session token helper utilities."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from bit_indie_api.services import session_tokens


def test_create_and_decode_session_token_round_trip() -> None:
    """Tokens should encode the user identifier and expiration timestamp."""

    secret = "test-secret"
    token = session_tokens.create_session_token(user_id="user-123", secret=secret, ttl_seconds=3600)

    claims = session_tokens.decode_session_token(token=token, secret=secret)

    assert claims.user_id == "user-123"
    assert claims.expires_at > claims.issued_at
    assert isinstance(claims.nonce, str)
    assert claims.nonce


def test_decode_session_token_rejects_bad_signature() -> None:
    """Tokens signed with a different secret must be rejected."""

    token = session_tokens.create_session_token(user_id="user-456", secret="alpha", ttl_seconds=3600)

    with pytest.raises(session_tokens.InvalidSessionTokenError):
        session_tokens.decode_session_token(token=token, secret="beta")


def test_decode_session_token_rejects_expired(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tokens should not validate once their expiration time has passed."""

    secret = "secret-key"
    token = session_tokens.create_session_token(user_id="user-exp", secret=secret, ttl_seconds=60)

    future = datetime.now(timezone.utc) + timedelta(hours=2)

    class _FrozenTime:
        @staticmethod
        def time() -> float:
            return future.timestamp()

    monkeypatch.setattr(session_tokens, "time", _FrozenTime())

    with pytest.raises(session_tokens.ExpiredSessionTokenError):
        session_tokens.decode_session_token(token=token, secret=secret)


def test_create_session_token_validates_ttl() -> None:
    """Creating a token with a non-positive TTL should fail."""

    with pytest.raises(ValueError):
        session_tokens.create_session_token(user_id="user", secret="secret", ttl_seconds=0)
