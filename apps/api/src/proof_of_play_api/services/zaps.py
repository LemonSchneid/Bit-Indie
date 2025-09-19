"""Ingestion helpers for Lightning zap receipts delivered via Nostr relays."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from proof_of_play_api.core.metrics import get_metrics_client, MetricsClient
from proof_of_play_api.db.models import Review, Zap, ZapTargetType
from proof_of_play_api.services.nostr import (
    InvalidNostrEventError,
    NostrEventLike,
    SignatureVerificationError,
    verify_signed_event,
)
from proof_of_play_api.services.review_ranking import update_review_helpful_score


logger = logging.getLogger(__name__)

_metrics: MetricsClient = get_metrics_client()


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
_CORRELATION_MIN_ZAPS = 3
_CORRELATION_DOMINANCE_SHARE = 0.85


def _get_tag_value(tags: Sequence[Sequence[str]], name: str) -> str | None:
    """Return the first tag value for the provided name, if present."""

    for tag in tags:
        if len(tag) >= 2 and tag[0] == name:
            return tag[1]
    return None


def _gather_excluded_pubkeys(review: Review, to_pubkey: str | None) -> set[str]:
    """Return pubkeys whose zaps should not influence review totals."""

    excluded: set[str] = set()
    author = review.user
    if author is not None and author.pubkey_hex:
        excluded.add(author.pubkey_hex)

    if to_pubkey:
        excluded.add(to_pubkey)

    game = getattr(review, "game", None)
    if game is not None:
        developer = getattr(game, "developer", None)
        if developer is not None:
            developer_user = getattr(developer, "user", None)
            if developer_user is not None and developer_user.pubkey_hex:
                excluded.add(developer_user.pubkey_hex)

    return excluded


def _fetch_non_self_zap_totals(
    *, session: Session, review_id: str, excluded_pubkeys: set[str]
):
    """Return aggregated zap stats excluding disallowed pubkeys."""

    stmt = (
        select(
            Zap.from_pubkey.label("from_pubkey"),
            func.count().label("zap_count"),
            func.coalesce(func.sum(Zap.amount_msats), 0).label("total_msats"),
        )
        .where(Zap.target_type == ZapTargetType.REVIEW)
        .where(Zap.target_id == review_id)
        .group_by(Zap.from_pubkey)
    )
    if excluded_pubkeys:
        stmt = stmt.where(Zap.from_pubkey.notin_(list(excluded_pubkeys)))
    return session.execute(stmt).all()


def _should_flag_correlation(zap_totals, *, total_msats: int) -> bool:
    """Return ``True`` when zap activity suggests correlated behaviour."""

    if total_msats <= 0:
        return False

    total_count = sum(int(row.zap_count) for row in zap_totals)
    if total_count < _CORRELATION_MIN_ZAPS:
        return False

    top_amount = max(int(row.total_msats) for row in zap_totals)
    dominance_share = top_amount / total_msats
    return dominance_share >= _CORRELATION_DOMINANCE_SHARE


def _record_zap_error(*, reason: str, event: NostrEventLike) -> None:
    """Increment metrics and emit structured logs for zap parsing issues."""

    event_id = getattr(event, "id", None)
    _metrics.increment(
        "nostr.zaps.parse_errors",
        tags={"reason": reason, "source": "receipt"},
    )
    logger.warning(
        "zap.receipt.invalid",
        extra={"reason": reason, "event_id": event_id},
    )


def _invalid_receipt(
    message: str,
    *,
    reason: str,
    event: NostrEventLike,
) -> InvalidZapReceiptError:
    """Return a consistently instrumented zap receipt error."""

    _record_zap_error(reason=reason, event=event)
    return InvalidZapReceiptError(message)


def ingest_zap_receipt(*, session: Session, event: NostrEventLike) -> tuple[Zap, Review]:
    """Persist a zap receipt and recompute the helpful score for the review."""

    if event.kind != ZAP_RECEIPT_KIND:
        msg = "Unsupported event kind for zap receipts."
        raise _invalid_receipt(msg, reason="unsupported_kind", event=event)

    try:
        verify_signed_event(event)
    except InvalidNostrEventError as exc:
        _record_zap_error(reason="invalid_event", event=event)
        raise InvalidZapReceiptError(str(exc)) from exc
    except SignatureVerificationError as exc:
        _record_zap_error(reason="invalid_signature", event=event)
        raise

    amount_raw = _get_tag_value(event.tags, "amount")
    if amount_raw is None:
        msg = "Zap receipt missing amount tag."
        raise _invalid_receipt(msg, reason="missing_amount", event=event)

    try:
        amount_msats = int(amount_raw)
    except ValueError as exc:  # pragma: no cover - defensive
        raise _invalid_receipt(
            "Zap amount must be an integer.",
            reason="invalid_amount",
            event=event,
        ) from exc

    if amount_msats <= 0:
        msg = "Zap amount must be positive."
        raise _invalid_receipt(msg, reason="non_positive_amount", event=event)

    review_id = _get_tag_value(event.tags, _REVIEW_TAG)
    if review_id is None:
        msg = "Zap receipt missing review reference tag."
        raise _invalid_receipt(msg, reason="missing_review_tag", event=event)

    to_pubkey = _get_tag_value(event.tags, "p")
    if to_pubkey is None:
        msg = "Zap receipt missing recipient pubkey tag."
        raise _invalid_receipt(msg, reason="missing_recipient", event=event)

    existing = session.scalar(select(Zap).where(Zap.event_id == event.id))
    if existing is not None:
        msg = "Zap receipt has already been processed."
        raise ZapAlreadyProcessedError(msg)

    review = session.get(Review, review_id)
    if review is None:
        msg = "Review not found for zap receipt."
        raise ZapTargetNotFoundError(msg)

    user = review.user
    if user is None:  # pragma: no cover - defensive
        session.refresh(review)
        user = review.user
        if user is None:
            msg = "Review author missing for zap receipt."
            raise ZapTargetNotFoundError(msg)

    excluded_pubkeys = _gather_excluded_pubkeys(review, to_pubkey)

    try:
        received_at = datetime.fromtimestamp(event.created_at, tz=timezone.utc)
    except (OverflowError, OSError, ValueError) as exc:  # pragma: no cover - defensive
        raise _invalid_receipt(
            "Zap receipt timestamp is invalid.",
            reason="invalid_timestamp",
            event=event,
        ) from exc

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

    zap_totals = _fetch_non_self_zap_totals(
        session=session, review_id=review.id, excluded_pubkeys=excluded_pubkeys
    )
    total_msats = sum(int(row.total_msats) for row in zap_totals)
    total_msats = int(total_msats)
    flagged_suspicious = _should_flag_correlation(
        zap_totals, total_msats=total_msats
    )

    update_review_helpful_score(
        review=review,
        user=user,
        total_zap_msats=total_msats,
        flagged_suspicious=flagged_suspicious,
    )
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
