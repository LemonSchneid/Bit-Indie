"""Business logic for managing first-party user accounts."""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from bit_indie_api.core.config import ApiSettings, get_settings
from bit_indie_api.db import get_session
from bit_indie_api.db.models import User
from bit_indie_api.services.passwords import hash_password, verify_password
from bit_indie_api.services.session_tokens import create_session_token


class AccountError(RuntimeError):
    """Base error for account management operations."""


class EmailAlreadyRegisteredError(AccountError):
    """Raised when attempting to register an email that already exists."""


class InvalidCredentialsError(AccountError):
    """Raised when login attempts provide mismatched credentials."""


class UserNotFoundError(AccountError):
    """Raised when requesting a session for a non-existent user."""


ACCOUNT_IDENTIFIER_PREFIX = "acct"
ACCOUNT_IDENTIFIER_MAX_LENGTH = 160


@dataclass
class AccountService:
    """Domain service encapsulating account registration and authentication."""

    session: Session
    settings: ApiSettings

    def register_user(self, *, email: str, password: str, display_name: str | None) -> User:
        """Create a new user ensuring the email and identifier are unique."""

        normalized_email = self._normalize_email(email)
        if self._email_exists(normalized_email):
            msg = "An account with this email already exists."
            raise EmailAlreadyRegisteredError(msg)

        identifier = self._generate_account_identifier(normalized_email)
        stored_name = self._sanitize_display_name(display_name) or self._default_display_name(normalized_email)
        password_hash = hash_password(password)

        user = User(
            account_identifier=identifier,
            email=normalized_email,
            password_hash=password_hash,
            display_name=stored_name,
        )
        self.session.add(user)
        self.session.flush()
        self.session.refresh(user)
        return user

    def authenticate_user(self, *, email: str, password: str) -> User:
        """Validate login credentials returning the persisted user record."""

        normalized_email = self._normalize_email(email)
        user = self._get_user_by_email(normalized_email)
        if user is None or not user.password_hash or not verify_password(password, user.password_hash):
            msg = "Invalid email or password."
            raise InvalidCredentialsError(msg)
        return user

    def get_user_by_id(self, *, user_id: str) -> User:
        """Return the persisted user identified by ``user_id``."""

        user = self.session.get(User, user_id)
        if user is None:
            msg = "User not found."
            raise UserNotFoundError(msg)
        return user

    def issue_session_token(self, *, user: User) -> str:
        """Return a signed session token for ``user`` respecting configured TTLs."""

        return create_session_token(
            user_id=user.id,
            secret=self.settings.session_secret,
            ttl_seconds=self.settings.session_ttl_seconds,
        )

    def _email_exists(self, email: str) -> bool:
        """Return ``True`` when the supplied email already exists."""

        stmt = select(User.id).where(User.email == email)
        return self.session.scalars(stmt).first() is not None

    def _get_user_by_email(self, email: str) -> User | None:
        """Return the user associated with ``email`` if present."""

        stmt = select(User).where(User.email == email)
        return self.session.scalars(stmt).first()

    @staticmethod
    def _normalize_email(email: str) -> str:
        """Trim and lowercase the supplied email address."""

        normalized = email.strip().lower()
        if not normalized:
            msg = "Email address is required."
            raise ValueError(msg)
        return normalized

    def _generate_account_identifier(self, email: str) -> str:
        """Return a unique account identifier derived from ``email``."""

        base = self._build_identifier_base(email)
        for attempt in range(10):
            candidate = base if attempt == 0 else f"{base}-{attempt}"
            candidate = candidate[:ACCOUNT_IDENTIFIER_MAX_LENGTH]
            if not self._identifier_exists(candidate):
                return candidate

        fallback = f"{ACCOUNT_IDENTIFIER_PREFIX}-{uuid.uuid4().hex[:24]}"
        fallback = fallback[:ACCOUNT_IDENTIFIER_MAX_LENGTH]
        return fallback

    def _identifier_exists(self, identifier: str) -> bool:
        """Return ``True`` when the account identifier is already taken."""

        stmt = select(User.id).where(User.account_identifier == identifier)
        return self.session.scalars(stmt).first() is not None

    @staticmethod
    def _build_identifier_base(email: str) -> str:
        """Return the sanitized identifier base derived from ``email``."""

        local_part, _, domain = email.partition("@")
        seed = local_part or domain or uuid.uuid4().hex
        sanitized = re.sub(r"[^a-z0-9]+", "-", seed.lower()).strip("-")
        if not sanitized:
            sanitized = uuid.uuid4().hex[:8]
        prefix = f"{ACCOUNT_IDENTIFIER_PREFIX}-{sanitized}"
        if len(prefix) > ACCOUNT_IDENTIFIER_MAX_LENGTH:
            prefix = prefix[:ACCOUNT_IDENTIFIER_MAX_LENGTH]
        return prefix

    @staticmethod
    def _sanitize_display_name(display_name: str | None) -> str | None:
        """Return a cleaned display name if provided."""

        if display_name is None:
            return None
        cleaned = display_name.strip()
        return cleaned or None

    @staticmethod
    def _default_display_name(email: str) -> str:
        """Derive a friendly fallback display name from the email address."""

        local_part, _, _ = email.partition("@")
        base = local_part or "Player"
        words = re.split(r"[._-]+", base)
        capitalized = " ".join(word.capitalize() for word in words if word)
        return capitalized or "Player"


def get_account_service(
    session: Session = Depends(get_session),
) -> AccountService:
    """FastAPI dependency returning an ``AccountService`` bound to the current session."""

    settings = get_settings()
    return AccountService(session=session, settings=settings)


__all__ = [
    "AccountService",
    "AccountError",
    "EmailAlreadyRegisteredError",
    "InvalidCredentialsError",
    "UserNotFoundError",
    "get_account_service",
]
