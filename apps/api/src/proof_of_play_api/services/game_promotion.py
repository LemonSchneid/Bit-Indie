"""Helpers for transitioning games between catalog visibility tiers."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from proof_of_play_api.db.models import (
    Game,
    GameStatus,
    InvoiceStatus,
    Purchase,
    Review,
)


def maybe_promote_game_to_discover(*, session: Session, game: Game) -> bool:
    """Promote a game from ``UNLISTED`` to ``DISCOVER`` when thresholds are met.

    A game becomes eligible for the Discover shelf once it has at least one
    verified purchase (an associated ``Purchase`` record marked as paid) and at
    least one review. The transition only occurs for active games that are
    currently unlisted. The function returns ``True`` when a promotion is
    applied so callers can persist the change immediately.
    """

    if not game.active or game.status is not GameStatus.UNLISTED:
        return False

    has_verified_purchase = session.scalar(
        select(Purchase.id)
        .where(Purchase.game_id == game.id)
        .where(Purchase.invoice_status == InvoiceStatus.PAID)
        .limit(1)
    )
    if has_verified_purchase is None:
        return False

    has_review = session.scalar(
        select(Review.id)
        .where(Review.game_id == game.id)
        .where(Review.is_hidden.is_(False))
        .limit(1)
    )
    if has_review is None:
        return False

    game.status = GameStatus.DISCOVER
    return True


__all__ = ["maybe_promote_game_to_discover"]

