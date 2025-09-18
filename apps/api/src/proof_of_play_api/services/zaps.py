"""Ingestion helpers for Lightning zap receipts delivered via Nostr relays."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from proof_of_play_api.db.models import Review, Zap, ZapTargetType
from proof_of_play_api.services.nostr import (
    InvalidNostrEventError,
    NostrEventLike,
    SignatureVerificationError,
    verify_signed_event,
)
from proof_of_play_api.services.review_ranking import update_review_helpful_score


class ZapProcessingError(RuntimeError):
    """Base error raised when a zap receipt cannot be processed."""


class InvalidZapReceiptError(ZapProcessingError):
    """Raised when an event is missing required zap metadata."""


class ZapAlreadyProcessedError(ZapProcessingError):
    """Raised when a zap receipt event has already been stored."""


class ZapTargetNotFoundError(ZapProcessingError):
    """Raised when a zap receipt references a missing review."""


ZAP_RECEIPT_KIND = 9735
_REVIEW_TAG = "proof-of-play-review"


def _get_tag_value(tags: Sequence[Sequence[str]], name: str) -> str | None:
    """Return the first tag value for the provided name, if present."""

    for tag in tags:
        if len(tag) >= 2 and tag[0] == name:
            return tag[1]
    return None


def ingest_zap_receipt(*, session: Session, event: NostrEventLike) -> tuple[Zap, Review]:
    """Persist a zap receipt and recompute the helpful score for the review."""

    if event.kind != ZAP_RECEIPT_KIND:
        msg = "Unsupported event kind for zap receipts."
        raise InvalidZapReceiptError(msg)

    try:
        verify_signed_event(event)
    except InvalidNostrEventError as exc:
        raise InvalidZapReceiptError(str(exc)) from exc
    except SignatureVerificationError:
        raise

    amount_raw = _get_tag_value(event.tags, "amount")
    if amount_raw is None:
        msg = "Zap receipt missing amount tag."
        raise InvalidZapReceiptError(msg)

    try:
        amount_msats = int(amount_raw)
    except ValueError as exc:  # pragma: no cover - defensive
        raise InvalidZapReceiptError("Zap amount must be an integer.") from exc

    if amount_msats <= 0:
        msg = "Zap amount must be positive."
        raise InvalidZapReceiptError(msg)

    review_id = _get_tag_value(event.tags, _REVIEW_TAG)
    if review_id is None:
        msg = "Zap receipt missing review reference tag."
        raise InvalidZapReceiptError(msg)

    to_pubkey = _get_tag_value(event.tags, "p")
    if to_pubkey is None:
        msg = "Zap receipt missing recipient pubkey tag."
        raise InvalidZapReceiptError(msg)

    existing = session.scalar(select(Zap).where(Zap.event_id == event.id))
    if existing is not None:
        msg = "Zap receipt has already been processed."
        raise ZapAlreadyProcessedError(msg)

    review = session.get(Review, review_id)
    if review is None:
        msg = "Review not found for zap receipt."
        raise ZapTargetNotFoundError(msg)

    try:
        received_at = datetime.fromtimestamp(event.created_at, tz=timezone.utc)
    except (OverflowError, OSError, ValueError) as exc:  # pragma: no cover - defensive
        raise InvalidZapReceiptError("Zap receipt timestamp is invalid.") from exc

    zap = Zap(
        target_type=ZapTargetType.REVIEW,
        target_id=review.id,
        from_pubkey=event.pubkey,
        to_pubkey=to_pubkey,
        amount_msats=amount_msats,
        event_id=event.id,
        received_at=received_at,
    )
    session.add(zap)
    session.flush()

    total_msats = session.scalar(
        select(func.coalesce(func.sum(Zap.amount_msats), 0)).where(
            Zap.target_type == ZapTargetType.REVIEW,
            Zap.target_id == review.id,
        )
    )
    if total_msats is None:  # pragma: no cover - defensive
        total_msats = 0

    user = review.user
    if user is None:  # pragma: no cover - defensive
        session.refresh(review)
        user = review.user
        if user is None:
            msg = "Review author missing for zap receipt."
            raise ZapTargetNotFoundError(msg)

    update_review_helpful_score(review=review, user=user, total_zap_msats=total_msats)
    session.flush()
    session.refresh(review)

    return zap, review


__all__ = [
    "InvalidZapReceiptError",
    "ZapAlreadyProcessedError",
    "ZapProcessingError",
    "ZapTargetNotFoundError",
    "ingest_zap_receipt",
]
