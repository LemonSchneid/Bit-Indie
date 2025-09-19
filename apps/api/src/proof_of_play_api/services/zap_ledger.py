"""Aggregation helpers for Lightning zap receipts targeting games and platform."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from proof_of_play_api.db.models import (
    Game,
    ZapLedgerEvent,
    ZapLedgerTotal,
    ZapSource,
    ZapTargetType,
)
from proof_of_play_api.services.nostr import (
    InvalidNostrEventError,
    NostrEventLike,
    SignatureVerificationError,
    verify_signed_event,
)

logger = logging.getLogger(__name__)

_ZAP_TARGET_TAG = "proof-of-play-zap-target"
_DEFAULT_PLATFORM_TARGET_ID = "platform"
_VALID_TARGET_TYPES = {ZapTargetType.GAME, ZapTargetType.PLATFORM}


class ZapLedgerError(RuntimeError):
    """Base error raised when a zap ledger event cannot be processed."""


class ZapLedgerParseError(ZapLedgerError):
    """Raised when a zap receipt is missing required zap ledger metadata."""


@dataclass(frozen=True)
class _ZapContribution:
    """Intermediate representation of a zap contribution extracted from tags."""

    target_type: ZapTargetType
    target_id: str
    amount_msats: int
    zap_source: ZapSource


class ZapLedger:
    """Idempotent aggregator that records zap receipts per target."""

    def record_event(self, *, session: Session, event: NostrEventLike) -> ZapLedgerEvent:
        """Parse a zap receipt event and update aggregated ledger totals."""

        if event.kind != 9735:
            msg = "Unsupported event kind for zap ledger ingestion."
            raise ZapLedgerParseError(msg)

        try:
            verify_signed_event(event)
        except InvalidNostrEventError as exc:
            self._log_parse_error(event_id=event.id, reason=str(exc))
            raise ZapLedgerParseError(str(exc)) from exc
        except SignatureVerificationError:
            raise

        existing = session.scalar(
            select(ZapLedgerEvent).where(ZapLedgerEvent.event_id == event.id)
        )
        if existing is not None:
            return existing

        try:
            contributions = self._extract_contributions(session=session, event=event)
        except ZapLedgerParseError:
            raise

        if not contributions:
            reason = "Zap ledger event did not contain any contributions."
            self._log_parse_error(event_id=event.id, reason=reason)
            raise ZapLedgerParseError(reason)

        try:
            event_created_at = datetime.fromtimestamp(event.created_at, tz=timezone.utc)
        except (OverflowError, OSError, ValueError) as exc:
            reason = "Zap ledger event timestamp is invalid."
            self._log_parse_error(event_id=event.id, reason=reason)
            raise ZapLedgerParseError(reason) from exc

        total_msats = sum(contribution.amount_msats for contribution in contributions)
        part_count = len(contributions)

        ledger_event = ZapLedgerEvent(
            event_id=event.id,
            sender_pubkey=event.pubkey,
            total_msats=total_msats,
            part_count=part_count,
            event_created_at=event_created_at,
        )
        session.add(ledger_event)
        session.flush()

        for contribution in contributions:
            total_row = self._get_or_create_total(session=session, contribution=contribution)
            total_row.total_msats += contribution.amount_msats
            total_row.zap_count += 1
            total_row.last_event_at = event_created_at
            total_row.last_event_id = event.id

        session.flush()
        session.refresh(ledger_event)
        return ledger_event

    def _extract_contributions(
        self, *, session: Session, event: NostrEventLike
    ) -> list[_ZapContribution]:
        """Return parsed zap contributions from the provided event tags."""

        contributions: list[_ZapContribution] = []
        parse_errors: list[str] = []

        for tag in event.tags:
            if not tag or tag[0] != _ZAP_TARGET_TAG:
                continue
            try:
                contribution = self._parse_target_tag(session=session, tag=tag)
            except ZapLedgerParseError as exc:
                parse_errors.append(str(exc))
                continue
            contributions.append(contribution)

        if parse_errors:
            reason = "; ".join(parse_errors)
            self._log_parse_error(event_id=event.id, reason=reason)
            raise ZapLedgerParseError(reason)

        return contributions

    def _parse_target_tag(
        self, *, session: Session, tag: Sequence[str]
    ) -> _ZapContribution:
        """Convert a zap target tag into a structured contribution object."""

        if len(tag) < 4:
            msg = "Zap target tag is missing required fields."
            raise ZapLedgerParseError(msg)

        raw_target_type = tag[1].strip().upper()
        try:
            target_type = ZapTargetType(raw_target_type)
        except ValueError as exc:
            msg = f"Unsupported zap target type: {raw_target_type}"
            raise ZapLedgerParseError(msg) from exc

        if target_type not in _VALID_TARGET_TYPES:
            msg = f"Zap ledger does not support target type: {target_type.value}"
            raise ZapLedgerParseError(msg)

        raw_target_id = tag[2].strip()
        target_id = raw_target_id or (
            _DEFAULT_PLATFORM_TARGET_ID if target_type == ZapTargetType.PLATFORM else ""
        )
        if not target_id:
            msg = "Zap target identifier cannot be empty."
            raise ZapLedgerParseError(msg)

        if target_type == ZapTargetType.GAME:
            if session.get(Game, target_id) is None:
                msg = f"Unknown game referenced by zap ledger event: {target_id}"
                raise ZapLedgerParseError(msg)

        amount_raw = tag[3].strip()
        try:
            amount_msats = int(amount_raw)
        except ValueError as exc:
            msg = "Zap target tag amount must be an integer."
            raise ZapLedgerParseError(msg) from exc
        if amount_msats <= 0:
            msg = "Zap target tag amount must be positive."
            raise ZapLedgerParseError(msg)

        zap_source = self._determine_source(tag)

        return _ZapContribution(
            target_type=target_type,
            target_id=target_id,
            amount_msats=amount_msats,
            zap_source=zap_source,
        )

    def _determine_source(self, tag: Sequence[str]) -> ZapSource:
        """Return the zap source classification for the provided tag."""

        if len(tag) >= 5 and tag[4].strip():
            candidate = tag[4].strip().upper()
            if candidate == "MULTI_HOP":
                return ZapSource.FORWARDED
            try:
                return ZapSource(candidate)
            except ValueError as exc:
                msg = f"Unsupported zap source value: {candidate}"
                raise ZapLedgerParseError(msg) from exc
        return ZapSource.DIRECT

    def _get_or_create_total(
        self, *, session: Session, contribution: _ZapContribution
    ) -> ZapLedgerTotal:
        """Return an existing aggregate row or create a new one for the target."""

        stmt = select(ZapLedgerTotal).where(
            ZapLedgerTotal.target_type == contribution.target_type,
            ZapLedgerTotal.target_id == contribution.target_id,
            ZapLedgerTotal.zap_source == contribution.zap_source,
        )
        total = session.scalar(stmt)
        if total is not None:
            return total

        total = ZapLedgerTotal(
            target_type=contribution.target_type,
            target_id=contribution.target_id,
            zap_source=contribution.zap_source,
        )
        session.add(total)
        session.flush()
        return total

    def _log_parse_error(self, *, event_id: str, reason: str) -> None:
        """Emit a structured warning when zap events cannot be parsed."""

        logger.warning("zap_ledger_parse_error", extra={"event_id": event_id, "reason": reason})


__all__ = ["ZapLedger", "ZapLedgerError", "ZapLedgerParseError"]
