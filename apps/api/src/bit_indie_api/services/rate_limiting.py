"""Helpers for enforcing per-user rate limits on content creation."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Final, Type

from sqlalchemy import func, select
from sqlalchemy.orm import Session


logger = logging.getLogger(__name__)

COMMENT_RATE_LIMIT_WINDOW_SECONDS: Final[int] = 3600
"""Duration of the rolling window for comment rate limiting (1 hour)."""

COMMENT_RATE_LIMIT_MAX_ITEMS: Final[int] = 5
"""Maximum number of comments a user may post within the rate limit window."""

FLAG_RATE_LIMIT_WINDOW_SECONDS: Final[int] = 3600
"""Duration of the rolling window governing moderation flag submissions (1 hour)."""

FLAG_RATE_LIMIT_MAX_ITEMS: Final[int] = 10
"""Maximum number of moderation flags a user may submit within the rate limit window."""


@dataclass(slots=True)
class RateLimitExceeded(RuntimeError):
    """Raised when a user attempts to exceed a configured rate limit."""

    retry_after_seconds: int


def _calculate_retry_after(
    *,
    session: Session,
    model: Type,
    user_id: str,
    window_seconds: int,
    max_items: int,
    window_start: datetime,
) -> int:
    """Return the remaining seconds before another action is permitted."""

    target_stmt = (
        select(model.created_at)
        .where(model.user_id == user_id)
        .where(model.created_at >= window_start)
        .order_by(model.created_at.desc())
        .offset(max_items - 1)
        .limit(1)
    )
    target = session.scalar(target_stmt)
    if target is None:
        return window_seconds

    now = datetime.now(timezone.utc)
    if target.tzinfo is None:
        target = target.replace(tzinfo=timezone.utc)
    elapsed = (now - target).total_seconds()
    remaining = window_seconds - int(elapsed)
    return max(1, remaining)


def enforce_rate_limit(
    *,
    session: Session,
    model: Type,
    user_id: str,
    window_seconds: int,
    max_items: int,
    action: str,
    resource_id: str | None = None,
) -> None:
    """Raise an error if the number of actions exceeds the configured limit."""

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=window_seconds)

    count_stmt = (
        select(func.count())
        .select_from(model)
        .where(model.user_id == user_id)
        .where(model.created_at >= window_start)
    )
    attempts = int(session.scalar(count_stmt) or 0)
    if attempts < max_items:
        return

    retry_after = _calculate_retry_after(
        session=session,
        model=model,
        user_id=user_id,
        window_seconds=window_seconds,
        max_items=max_items,
        window_start=window_start,
    )
    logger.info(
        "rate_limit_exceeded",
        extra={
            "user_id": user_id,
            "action": action,
            "resource_id": resource_id,
            "window_seconds": window_seconds,
            "max_items": max_items,
        },
    )
    raise RateLimitExceeded(retry_after_seconds=retry_after)


__all__ = [
    "COMMENT_RATE_LIMIT_MAX_ITEMS",
    "COMMENT_RATE_LIMIT_WINDOW_SECONDS",
    "FLAG_RATE_LIMIT_MAX_ITEMS",
    "FLAG_RATE_LIMIT_WINDOW_SECONDS",
    "RateLimitExceeded",
    "enforce_rate_limit",
]
