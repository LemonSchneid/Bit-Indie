"""Guest checkout helpers for creating anonymous player accounts."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from bit_indie_api.db import get_session
from bit_indie_api.db.models import User


class GuestCheckoutError(ValueError):
    """Raised when guest checkout inputs are invalid."""


@dataclass
class GuestCheckoutService:
    """Business logic for managing anonymous guest players."""

    session: Session

    def ensure_guest_user(self, *, anon_id: str) -> User:
        """Return the guest user for ``anon_id`` creating it on first use."""

        normalized = self._normalize_anon_id(anon_id)
        existing = self._lookup_user(normalized)
        if existing is not None:
            return existing

        user = User(
            account_identifier=self._build_account_identifier(normalized),
            display_name="Guest Player",
        )
        self.session.add(user)
        self.session.flush()
        self.session.refresh(user)
        return user

    def get_guest_user(self, *, anon_id: str) -> User | None:
        """Return the guest user for ``anon_id`` if it exists."""

        normalized = self._normalize_anon_id(anon_id)
        return self._lookup_user(normalized)

    def _lookup_user(self, anon_id: str) -> User | None:
        """Fetch the stored guest user associated with ``anon_id``."""

        stmt = select(User).where(
            User.account_identifier == self._build_account_identifier(anon_id)
        )
        return self.session.scalars(stmt).first()

    @staticmethod
    def _normalize_anon_id(anon_id: str) -> str:
        """Trim and validate the caller supplied anonymous identifier."""

        normalized = anon_id.strip()
        if not normalized:
            msg = "Anonymous identifier is required for guest checkout."
            raise GuestCheckoutError(msg)
        if len(normalized) > 120:
            msg = "Anonymous identifier is too long."
            raise GuestCheckoutError(msg)
        return normalized

    @staticmethod
    def _build_account_identifier(anon_id: str) -> str:
        """Return the synthetic account identifier used to persist guest accounts."""

        return f"anon:{anon_id}"


def get_guest_checkout_service(
    session: Session = Depends(get_session),
) -> GuestCheckoutService:
    """FastAPI dependency returning a guest checkout service bound to ``session``."""

    return GuestCheckoutService(session=session)


__all__ = [
    "GuestCheckoutError",
    "GuestCheckoutService",
    "get_guest_checkout_service",
]
