"""Helpers for transitioning games between catalog visibility tiers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from proof_of_play_api.db.models import (
    Game,
    GameStatus,
    InvoiceStatus,
    Purchase,
    RefundStatus,
    Review,
)

# Thresholds governing the featured rotation.
_FEATURED_MIN_VERIFIED_REVIEWS = 10
_FEATURED_MAX_REFUND_RATE = 0.05
_FEATURED_UPDATE_WINDOW = timedelta(days=30)


@dataclass
class FeaturedEligibility:
    """Aggregated metrics used to determine featured shelf eligibility."""

    verified_review_count: int
    paid_purchase_count: int
    refunded_purchase_count: int
    updated_within_window: bool
    is_active: bool

    @property
    def refund_rate(self) -> float:
        """Return the proportion of paid purchases that were refunded."""

        if self.paid_purchase_count <= 0:
            return 0.0
        return float(self.refunded_purchase_count) / float(self.paid_purchase_count)

    @property
    def meets_thresholds(self) -> bool:
        """Return ``True`` when the metrics satisfy featured criteria."""

        if not self.is_active:
            return False
        if self.verified_review_count < _FEATURED_MIN_VERIFIED_REVIEWS:
            return False
        if not self.updated_within_window:
            return False
        if self.paid_purchase_count <= 0:
            return False
        return self.refund_rate <= _FEATURED_MAX_REFUND_RATE


def maybe_promote_game_to_discover(*, session: Session, game: Game) -> bool:
    """Promote a game from ``UNLISTED`` to ``DISCOVER`` when thresholds are met.

    A game becomes eligible for the Discover shelf once it has at least one
    verified purchase (an associated ``Purchase`` record marked as paid) and at
    least one review. The transition only occurs for active games that are
    currently unlisted. The function returns ``True`` when a promotion is
    applied so callers can persist the change immediately.
    """

    if not game.active or game.status != GameStatus.UNLISTED:
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


def evaluate_featured_eligibility(
    *, session: Session, game: Game, reference: datetime | None = None
) -> FeaturedEligibility:
    """Return aggregated metrics describing a game's featured eligibility."""

    if reference is None:
        reference = datetime.now(timezone.utc)

    updated_within_window = False
    if game.updated_at is not None:
        updated_at = game.updated_at
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)
        updated_within_window = reference - updated_at <= _FEATURED_UPDATE_WINDOW

    verified_review_count = session.scalar(
        select(func.count())
        .select_from(Review)
        .where(Review.game_id == game.id)
        .where(Review.is_hidden.is_(False))
        .where(Review.is_verified_purchase.is_(True))
    )
    paid_purchase_count = session.scalar(
        select(func.count())
        .select_from(Purchase)
        .where(Purchase.game_id == game.id)
        .where(Purchase.paid_at.is_not(None))
    )
    refunded_purchase_count = session.scalar(
        select(func.count())
        .select_from(Purchase)
        .where(Purchase.game_id == game.id)
        .where(Purchase.refund_status == RefundStatus.PAID)
    )

    return FeaturedEligibility(
        verified_review_count=int(verified_review_count or 0),
        paid_purchase_count=int(paid_purchase_count or 0),
        refunded_purchase_count=int(refunded_purchase_count or 0),
        updated_within_window=bool(updated_within_window),
        is_active=bool(game.active),
    )


def update_game_featured_status(
    *,
    session: Session,
    game: Game,
    reference: datetime | None = None,
    eligibility: FeaturedEligibility | None = None,
) -> tuple[bool, FeaturedEligibility]:
    """Synchronise the stored featured status with the latest eligibility state."""

    if eligibility is None:
        eligibility = evaluate_featured_eligibility(
            session=session, game=game, reference=reference
        )

    changed = False
    if eligibility.meets_thresholds:
        if game.status != GameStatus.FEATURED:
            game.status = GameStatus.FEATURED
            changed = True
    else:
        if game.status == GameStatus.FEATURED:
            game.status = GameStatus.DISCOVER if game.active else GameStatus.UNLISTED
            changed = True

    return changed, eligibility


__all__ = [
    "FeaturedEligibility",
    "evaluate_featured_eligibility",
    "maybe_promote_game_to_discover",
    "update_game_featured_status",
]

