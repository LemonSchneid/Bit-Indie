"""Lightning zap aggregation for surfaced comments."""

from __future__ import annotations

from dataclasses import replace
from typing import Iterable, Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from bit_indie_api.db.models import Zap, ZapTargetType

from .dto import CommentDTO


class CommentZapAggregator:
    """Compute Lightning zap totals for surfaced comments."""

    def attach_totals(
        self,
        *,
        session: Session,
        comments: Sequence[CommentDTO],
    ) -> list[CommentDTO]:
        """Return comments enriched with aggregated zap totals."""

        identifiers = [comment.id for comment in comments if comment.id]
        if not identifiers:
            return list(comments)
        totals = self._load_comment_zap_totals(
            session=session, comment_ids=identifiers
        )
        enriched: list[CommentDTO] = []
        for comment in comments:
            total = totals.get(comment.id, 0)
            enriched.append(replace(comment, total_zap_msats=total))
        return enriched

    def _load_comment_zap_totals(
        self, *, session: Session, comment_ids: Iterable[str]
    ) -> dict[str, int]:
        identifiers = {comment_id for comment_id in comment_ids if comment_id}
        if not identifiers:
            return {}

        stmt = (
            select(
                Zap.target_id,
                func.coalesce(func.sum(Zap.amount_msats), 0).label("total_msats"),
            )
            .where(Zap.target_type == ZapTargetType.COMMENT)
            .where(Zap.target_id.in_(identifiers))
            .group_by(Zap.target_id)
        )
        rows = session.execute(stmt).all()
        return {row.target_id: int(row.total_msats) for row in rows}


__all__ = ["CommentZapAggregator"]
