from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

import pytest

from proof_of_play_api.db.models import Review, User
from proof_of_play_api.services.review_ranking import compute_review_helpful_score


def test_compute_review_helpful_score_applies_trust_and_decay() -> None:
    """The helpful score should incorporate trust multipliers and freshness decay."""

    reference = datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)
    user = User(pubkey_hex="alice", nip05="alice@example.com")
    review = Review(
        game_id="game-1",
        user_id="user-1",
        body_md="Great build!",
        rating=5,
        is_verified_purchase=True,
        created_at=reference - timedelta(days=15),
    )

    score = compute_review_helpful_score(
        review=review,
        user=user,
        total_zap_msats=10_000,
        reference=reference,
    )

    expected = math.log1p(10_000) * (1.0 + 0.2 + 0.3) * math.exp(-15 / 30)
    assert score == pytest.approx(expected)


def test_compute_review_helpful_score_respects_clamps() -> None:
    """Suspicious reviews should apply penalties and honour minimum decay values."""

    reference = datetime(2024, 5, 1, 12, 0, tzinfo=timezone.utc)
    user = User(pubkey_hex="bob")
    review = Review(
        game_id="game-2",
        user_id="user-2",
        body_md="Needs work",
        rating=None,
        is_verified_purchase=False,
        created_at=reference - timedelta(days=400),
    )

    score = compute_review_helpful_score(
        review=review,
        user=user,
        total_zap_msats=2_000,
        flagged_suspicious=True,
        reference=reference,
    )

    expected = math.log1p(2_000) * 0.5 * 0.5
    assert score == pytest.approx(expected)
