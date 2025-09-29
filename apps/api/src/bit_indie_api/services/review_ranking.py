"""Utilities for computing and updating review helpfulness scores."""

from __future__ import annotations

import math
from datetime import datetime, timezone

from bit_indie_api.db.models import Review, User

# Trust weighting constants derived from the MVP build plan specifications.
_BASE_TRUST = 1.0
_EMAIL_VERIFIED_BONUS = 0.2
_VERIFIED_PURCHASE_BONUS = 0.3
_MIN_TRUST = 0.1

# Freshness decay configuration: 30 day half-life with a floor at 0.5.
_DECAY_DAYS = 30.0
_MIN_DECAY = 0.5
_SECONDS_PER_DAY = 86_400.0


def _compute_trust_multiplier(*, has_verified_email: bool, is_verified_purchase: bool) -> float:
    """Return the trust multiplier for a review author."""

    trust = _BASE_TRUST
    if has_verified_email:
        trust += _EMAIL_VERIFIED_BONUS
    if is_verified_purchase:
        trust += _VERIFIED_PURCHASE_BONUS
    return max(trust, _MIN_TRUST)


def _compute_freshness_decay(created_at: datetime, reference: datetime | None = None) -> float:
    """Calculate the freshness decay multiplier based on review age."""

    if reference is None:
        reference = datetime.now(timezone.utc)
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    elapsed_seconds = max((reference - created_at).total_seconds(), 0.0)
    elapsed_days = elapsed_seconds / _SECONDS_PER_DAY
    raw_decay = math.exp(-elapsed_days / _DECAY_DAYS)
    return max(raw_decay, _MIN_DECAY)


def compute_review_helpful_score(
    *,
    review: Review,
    user: User,
    reference: datetime | None = None,
) -> float:
    """Return the helpfulness score for a review using the MVP formula."""

    trust_multiplier = _compute_trust_multiplier(
        has_verified_email=bool(user.email),
        is_verified_purchase=review.is_verified_purchase,
    )
    freshness_decay = _compute_freshness_decay(review.created_at, reference)
    rating_component = float(review.rating or 3)
    return rating_component * trust_multiplier * freshness_decay


def update_review_helpful_score(
    review: Review,
    user: User,
    *,
    reference: datetime | None = None,
) -> float:
    """Recalculate and persist the helpfulness score for a review instance."""

    score = compute_review_helpful_score(
        review=review,
        user=user,
        reference=reference,
    )
    review.helpful_score = score
    return score


__all__ = [
    "compute_review_helpful_score",
    "update_review_helpful_score",
]
