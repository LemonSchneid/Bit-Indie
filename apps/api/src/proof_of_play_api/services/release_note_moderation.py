"""Automated moderation helpers for release note replies fetched from relays."""

from __future__ import annotations

import re
from dataclasses import dataclass

from proof_of_play_api.db.models import ReleaseNoteReplyHiddenReason

_MIN_ALPHANUMERIC_CHARACTERS = 4
_PROFANE_WORDS = (
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "bastard",
)
_PROFANITY_PATTERNS = tuple(
    re.compile(rf"\b{re.escape(word)}\b", re.IGNORECASE) for word in _PROFANE_WORDS
)


@dataclass(frozen=True)
class ReplyModerationDecision:
    """Outcome describing whether a reply should be hidden from public timelines."""

    is_hidden: bool
    reason: ReleaseNoteReplyHiddenReason | None = None
    notes: str | None = None


def evaluate_reply_moderation(content: str) -> ReplyModerationDecision:
    """Return the moderation decision for the supplied reply body."""

    stripped = content.strip()
    if not stripped:
        return ReplyModerationDecision(
            is_hidden=True,
            reason=ReleaseNoteReplyHiddenReason.AUTOMATED_FILTER,
            notes="Reply body is empty.",
        )

    alnum_characters = sum(1 for char in stripped if char.isalnum())
    if alnum_characters < _MIN_ALPHANUMERIC_CHARACTERS:
        return ReplyModerationDecision(
            is_hidden=True,
            reason=ReleaseNoteReplyHiddenReason.AUTOMATED_FILTER,
            notes="Reply is too short to be useful.",
        )

    for pattern in _PROFANITY_PATTERNS:
        if pattern.search(stripped):
            return ReplyModerationDecision(
                is_hidden=True,
                reason=ReleaseNoteReplyHiddenReason.AUTOMATED_FILTER,
                notes="Reply contains profanity.",
            )

    return ReplyModerationDecision(is_hidden=False)


__all__ = ["ReplyModerationDecision", "evaluate_reply_moderation"]
