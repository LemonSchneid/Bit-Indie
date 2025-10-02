"""Lookup helpers for purchase records."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from bit_indie_api.db.models import InvoiceStatus, Purchase
from bit_indie_api.services.guest_checkout import GuestCheckoutError, GuestCheckoutService
from bit_indie_api.services.purchase_errors import (
    GuestLookupError,
    MissingLookupIdentifierError,
    PurchaseNotFoundError,
)


@dataclass(slots=True)
class PurchaseLookupService:
    """Resolve purchases for authenticated or guest buyers."""

    session: Session
    guest_checkout: GuestCheckoutService

    def lookup_purchase(
        self,
        *,
        game_id: str,
        user_id: str | None,
        anon_id: str | None,
    ) -> Purchase:
        """Return the newest purchase matching the provided identifiers."""

        lookup_user_id = user_id
        if lookup_user_id is None:
            if anon_id is None:
                raise MissingLookupIdentifierError()
            try:
                guest_user = self.guest_checkout.get_guest_user(anon_id=anon_id)
            except GuestCheckoutError as exc:  # pragma: no cover - defensive guard
                raise GuestLookupError(str(exc)) from exc
            if guest_user is None:
                raise PurchaseNotFoundError()
            lookup_user_id = guest_user.id

        order_by_columns = (Purchase.created_at.desc(), Purchase.id.desc())
        completed_stmt = (
            select(Purchase)
            .where(
                Purchase.game_id == game_id,
                Purchase.user_id == lookup_user_id,
                or_(
                    Purchase.download_granted.is_(True),
                    Purchase.invoice_status == InvoiceStatus.PAID,
                ),
            )
            .order_by(*order_by_columns)
            .limit(1)
        )
        purchase = self.session.scalars(completed_stmt).first()
        if purchase is None:
            fallback_stmt = (
                select(Purchase)
                .where(Purchase.game_id == game_id, Purchase.user_id == lookup_user_id)
                .order_by(*order_by_columns)
                .limit(1)
            )
            purchase = self.session.scalars(fallback_stmt).first()
        if purchase is None:
            raise PurchaseNotFoundError()
        return purchase


__all__ = ["PurchaseLookupService"]
