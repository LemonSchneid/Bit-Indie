"""Helpers for computing and executing revenue payouts."""

from __future__ import annotations

from dataclasses import dataclass

from bit_indie_api.db.models import PayoutStatus, Purchase
from bit_indie_api.services.payments import PaymentService, PaymentServiceError


@dataclass(slots=True, frozen=True)
class RevenueSplit:
    """Describe how a purchase's revenue is divided between stakeholders."""

    total_msats: int
    developer_msats: int
    platform_msats: int


def calculate_revenue_split(amount_msats: int) -> RevenueSplit:
    """Return a developer/platform split rounded to the nearest thousand msats."""

    total = max(0, amount_msats)
    if total == 0:
        return RevenueSplit(total_msats=0, developer_msats=0, platform_msats=0)

    developer_share = (total * 85) // 100
    platform_share = total - developer_share

    developer_share_rounded = (developer_share // 1000) * 1000
    developer_remainder = developer_share - developer_share_rounded
    developer_share = developer_share_rounded
    platform_share += developer_remainder

    platform_share_rounded = (platform_share // 1000) * 1000
    platform_remainder = platform_share - platform_share_rounded
    platform_share = platform_share_rounded
    developer_share += platform_remainder

    if developer_share == 0 and total >= 1000:
        developer_share = 1000
        platform_share = max(0, total - developer_share)
        platform_share = (platform_share // 1000) * 1000
        developer_share = total - platform_share

    return RevenueSplit(
        total_msats=total,
        developer_msats=developer_share,
        platform_msats=platform_share,
    )


@dataclass(slots=True)
class RevenuePayoutManager:
    """Issue Lightning payouts for completed purchases."""

    payments: PaymentService

    def process_purchase(self, purchase: Purchase) -> RevenueSplit | None:
        """Send developer and platform payouts for ``purchase`` when applicable."""

        game = purchase.game
        if game is None:
            return None

        amount_msats = purchase.amount_msats or 0
        if amount_msats <= 0:
            return RevenueSplit(total_msats=0, developer_msats=0, platform_msats=0)

        split = calculate_revenue_split(amount_msats)

        developer_address = game.developer_lightning_address
        treasury_address = self.payments.treasury_wallet_address

        if purchase.developer_payout_status is not PayoutStatus.COMPLETED:
            self._execute_payout(
                purchase=purchase,
                recipient="developer",
                address=developer_address,
                amount_msats=split.developer_msats,
                status_attr="developer_payout_status",
                reference_attr="developer_payout_reference",
                error_attr="developer_payout_error",
            )

        if purchase.platform_payout_status is not PayoutStatus.COMPLETED:
            self._execute_payout(
                purchase=purchase,
                recipient="platform",
                address=treasury_address,
                amount_msats=split.platform_msats,
                status_attr="platform_payout_status",
                reference_attr="platform_payout_reference",
                error_attr="platform_payout_error",
            )

        return split

    def _execute_payout(
        self,
        *,
        purchase: Purchase,
        recipient: str,
        address: str | None,
        amount_msats: int,
        status_attr: str,
        reference_attr: str,
        error_attr: str,
    ) -> None:
        """Issue a payout and persist the resulting status on ``purchase``."""

        status: PayoutStatus
        reference: str | None = None
        error_message: str | None = None

        if amount_msats <= 0:
            status = PayoutStatus.COMPLETED
        elif not address:
            status = PayoutStatus.FAILED
            error_message = f"Missing Lightning address for {recipient} payout."
        else:
            try:
                result = self.payments.send_payout(
                    amount_msats=amount_msats,
                    lightning_address=address,
                    memo=f"Bit Indie purchase {purchase.id} ({recipient})",
                )
            except PaymentServiceError as exc:
                status = PayoutStatus.FAILED
                error_message = str(exc)
            else:
                status = PayoutStatus.COMPLETED
                reference = result.payout_id

        setattr(purchase, status_attr, status)
        setattr(purchase, reference_attr, reference)
        setattr(purchase, error_attr, error_message)


__all__ = [
    "RevenuePayoutManager",
    "RevenueSplit",
    "calculate_revenue_split",
]
