from __future__ import annotations

import pytest

from bit_indie_api.services.purchase_payouts import calculate_revenue_split


@pytest.mark.parametrize(
    "amount_msats, expected_developer, expected_platform",
    [
        (100_000, 85_000, 15_000),
        (1_234_567, 1_049_567, 185_000),
        (1_000, 1_000, 0),
        (999, 999, 0),
    ],
)
def test_calculate_revenue_split_rounds_and_balances(
    amount_msats: int, expected_developer: int, expected_platform: int
) -> None:
    """Rounding and balancing should mirror production payout rules."""

    split = calculate_revenue_split(amount_msats)

    assert split.developer_msats == expected_developer
    assert split.platform_msats == expected_platform
    assert split.developer_msats + split.platform_msats == split.total_msats
    developer_remainder = split.developer_msats % 1000
    platform_remainder = split.platform_msats % 1000
    assert developer_remainder == 0 or platform_remainder == 0
    assert developer_remainder + platform_remainder == split.total_msats % 1000


def test_calculate_revenue_split_handles_negative_values() -> None:
    """Negative purchase totals should be clamped to zero before splitting."""

    split = calculate_revenue_split(-5_000)

    assert split.total_msats == 0
    assert split.developer_msats == 0
    assert split.platform_msats == 0
