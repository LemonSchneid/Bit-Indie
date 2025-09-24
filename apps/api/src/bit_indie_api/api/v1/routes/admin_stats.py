"""Integrity statistics endpoints for administrative dashboards."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from bit_indie_api.api.v1.routes.admin import require_admin_user
from bit_indie_api.db import get_session
from bit_indie_api.db.models import (
    ModerationFlag,
    ModerationFlagStatus,
    Purchase,
    RefundPayout,
    RefundStatus,
)
from bit_indie_api.schemas.admin import AdminIntegrityStats


router = APIRouter(prefix="/v1/admin/stats", tags=["admin"])

# A lightweight productivity heuristic for estimating moderator effort.
_MODERATION_MINUTES_PER_HANDLED_FLAG = 6


@router.get("", response_model=AdminIntegrityStats, summary="Summarize integrity metrics for admins")
def read_admin_integrity_stats(
    user_id: str,
    session: Session = Depends(get_session),
) -> AdminIntegrityStats:
    """Return refund and moderation snapshots for the integrity dashboard."""

    require_admin_user(session=session, user_id=user_id)

    total_paid_stmt = select(func.count()).select_from(Purchase).where(Purchase.paid_at.is_not(None))
    paid_purchase_count = session.execute(total_paid_stmt).scalar_one()

    refunded_stmt = (
        select(func.count())
        .select_from(Purchase)
        .where(Purchase.refund_status == RefundStatus.PAID)
    )
    refunded_purchase_count = session.execute(refunded_stmt).scalar_one()

    total_payout_stmt = select(func.coalesce(func.sum(RefundPayout.amount_msats), 0))
    total_refund_payout_msats_value = session.execute(total_payout_stmt).scalar_one()
    total_refund_payout_msats = int(total_refund_payout_msats_value or 0)

    refund_rate = 0.0
    if paid_purchase_count > 0:
        refund_rate = float(refunded_purchase_count) / float(paid_purchase_count)

    total_flag_stmt = select(func.count()).select_from(ModerationFlag)
    total_flag_count = session.execute(total_flag_stmt).scalar_one()

    actioned_stmt = (
        select(func.count())
        .select_from(ModerationFlag)
        .where(ModerationFlag.status == ModerationFlagStatus.ACTIONED)
    )
    actioned_flag_count = session.execute(actioned_stmt).scalar_one()

    dismissed_stmt = (
        select(func.count())
        .select_from(ModerationFlag)
        .where(ModerationFlag.status == ModerationFlagStatus.DISMISSED)
    )
    dismissed_flag_count = session.execute(dismissed_stmt).scalar_one()

    open_flag_count = max(total_flag_count - actioned_flag_count - dismissed_flag_count, 0)

    takedown_rate = 0.0
    if total_flag_count > 0:
        takedown_rate = float(actioned_flag_count) / float(total_flag_count)

    handled_flag_count = actioned_flag_count + dismissed_flag_count
    estimated_moderation_hours = round(
        (handled_flag_count * _MODERATION_MINUTES_PER_HANDLED_FLAG) / 60.0,
        2,
    )

    return AdminIntegrityStats(
        refund_rate=refund_rate,
        refunded_purchase_count=refunded_purchase_count,
        paid_purchase_count=paid_purchase_count,
        total_refund_payout_msats=total_refund_payout_msats,
        takedown_rate=takedown_rate,
        actioned_flag_count=actioned_flag_count,
        dismissed_flag_count=dismissed_flag_count,
        open_flag_count=open_flag_count,
        total_flag_count=total_flag_count,
        handled_flag_count=handled_flag_count,
        estimated_moderation_hours=estimated_moderation_hours,
    )


__all__ = ["read_admin_integrity_stats"]
