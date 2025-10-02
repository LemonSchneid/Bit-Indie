"""Shared helpers for verifying comment authorship."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from bit_indie_api.db.models import InvoiceStatus, Purchase


def load_verified_user_ids(
    *, session: Session, game_id: str, user_ids: Iterable[str]
) -> set[str]:
    """Return user identifiers with verified purchases for the supplied game."""

    ids = {user_id for user_id in user_ids if user_id}
    if not ids:
        return set()
    stmt = (
        select(Purchase.user_id)
        .where(Purchase.game_id == game_id)
        .where(Purchase.invoice_status == InvoiceStatus.PAID)
        .where(Purchase.user_id.in_(ids))
    )
    return set(session.scalars(stmt))


def has_verified_purchase(
    *, session: Session, game_id: str, user_id: str | None
) -> bool:
    """Return whether the user has a verified purchase for the supplied game."""

    if not user_id:
        return False
    verified_users = load_verified_user_ids(
        session=session, game_id=game_id, user_ids=[user_id]
    )
    return user_id in verified_users


__all__ = ["has_verified_purchase", "load_verified_user_ids"]
