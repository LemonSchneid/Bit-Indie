"""Mark a purchase as paid and grant the download (dev helper).

Usage::

    python -m proof_of_play_api.scripts.mark_purchase_paid --purchase-id <ID>
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from proof_of_play_api.db import session_scope
from proof_of_play_api.db.models import InvoiceStatus, Purchase, RefundStatus


def mark_paid(purchase_id: str) -> bool:
    with session_scope() as session:
        purchase = session.get(Purchase, purchase_id)
        if purchase is None:
            return False

        purchase.invoice_status = InvoiceStatus.PAID
        purchase.download_granted = True
        purchase.refund_requested = False
        purchase.refund_status = RefundStatus.NONE
        purchase.paid_at = datetime.now(timezone.utc)
        purchase.updated_at = datetime.now(timezone.utc)
        return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Mark a purchase as paid for local testing.")
    parser.add_argument("--purchase-id", required=True, help="Purchase identifier (UUID)")
    args = parser.parse_args()

    if mark_paid(args.purchase_id):
        print(f"Marked {args.purchase_id} as PAID and granted download access.")
    else:
        raise SystemExit(f"Purchase {args.purchase_id} not found.")


if __name__ == "__main__":
    main()
