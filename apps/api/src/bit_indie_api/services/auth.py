"""Authentication helpers for the Nostr-based login flow."""

from __future__ import annotations

import secrets
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Sequence


class ChallengeNotFoundError(LookupError):
    """Raised when attempting to use an unknown login challenge."""


class ChallengeExpiredError(RuntimeError):
    """Raised when a login challenge is no longer valid."""


@dataclass(frozen=True)
class LoginChallenge:
    """Immutable representation of an issued login challenge."""

    value: str
    issued_at: datetime
    expires_at: datetime


class LoginChallengeStore:
    """In-memory store that issues and validates login challenges."""

    def __init__(self, *, ttl: timedelta | None = None) -> None:
        self._ttl = ttl or timedelta(minutes=5)
        self._lock = threading.Lock()
        self._challenges: dict[str, LoginChallenge] = {}

    def issue(self) -> LoginChallenge:
        """Create and remember a new login challenge string."""

        now = datetime.now(timezone.utc)
        value = secrets.token_urlsafe(32)
        challenge = LoginChallenge(
            value=value,
            issued_at=now,
            expires_at=now + self._ttl,
        )
        with self._lock:
            self._prune_locked(now=now)
            self._challenges[value] = challenge
        return challenge

    def get(self, value: str) -> LoginChallenge:
        """Return a challenge if it exists and has not expired."""

        now = datetime.now(timezone.utc)
        with self._lock:
            challenge = self._challenges.get(value)
            if challenge is None:
                raise ChallengeNotFoundError("Unknown login challenge.")
            if challenge.expires_at < now:
                del self._challenges[value]
                raise ChallengeExpiredError("Login challenge has expired.")
            return challenge

    def consume(self, value: str) -> LoginChallenge:
        """Remove a challenge from the store after successful verification."""

        now = datetime.now(timezone.utc)
        with self._lock:
            challenge = self._challenges.pop(value, None)
        if challenge is None:
            raise ChallengeNotFoundError("Unknown login challenge.")
        if challenge.expires_at < now:
            raise ChallengeExpiredError("Login challenge has expired.")
        return challenge

    def clear(self) -> None:
        """Remove every challenge from the store. Intended for tests."""

        with self._lock:
            self._challenges.clear()

    @property
    def ttl(self) -> timedelta:
        """Expose the configured challenge lifetime."""

        return self._ttl

    def _prune_locked(self, *, now: datetime) -> None:
        """Delete expired challenges while holding the internal lock."""

        expired = [value for value, challenge in self._challenges.items() if challenge.expires_at < now]
        for value in expired:
            del self._challenges[value]


def extract_challenge_value(tags: Sequence[Sequence[str]]) -> str | None:
    """Return the first challenge tag value from a list of Nostr tags."""

    for tag in tags:
        if len(tag) >= 2 and tag[0] == "challenge":
            return tag[1]
    return None


_global_challenge_store = LoginChallengeStore()


def get_login_challenge_store() -> LoginChallengeStore:
    """Return the singleton login challenge store."""

    return _global_challenge_store


def reset_login_challenge_store() -> None:
    """Replace the global challenge store with a fresh instance."""

    global _global_challenge_store
    current_ttl = _global_challenge_store.ttl
    _global_challenge_store = LoginChallengeStore(ttl=current_ttl)
