"""DTO helpers for first-party comments."""

from __future__ import annotations

import enum
from dataclasses import dataclass
from datetime import datetime, timezone

from bit_indie_api.db.models import Comment, User

class CommentSource(str, enum.Enum):
    """Enumerates the possible origins for a surfaced comment."""

    FIRST_PARTY = "FIRST_PARTY"


@dataclass(frozen=True)
class CommentAuthorDTO:
    """Represents public-facing metadata about the author of a comment."""

    user_id: str | None
    account_identifier: str | None
    display_name: str | None
    lightning_address: str | None


@dataclass(frozen=True)
class CommentDTO:
    """Unified representation for storefront comments regardless of source."""

    id: str
    game_id: str
    body_md: str
    created_at: datetime
    source: CommentSource
    author: CommentAuthorDTO
    is_verified_purchase: bool


class CommentDTOBuilder:
    """Construct DTOs for first-party comments."""

    def build_first_party_comment(
        self,
        *,
        comment: Comment,
        user: User,
        is_verified_purchase: bool,
    ) -> CommentDTO:
        author = CommentAuthorDTO(
            user_id=user.id,
            account_identifier=user.account_identifier,
            display_name=user.display_name,
            lightning_address=user.lightning_address,
        )
        created_at = comment.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return CommentDTO(
            id=comment.id,
            game_id=comment.game_id,
            body_md=comment.body_md,
            created_at=created_at,
            source=CommentSource.FIRST_PARTY,
            author=author,
            is_verified_purchase=is_verified_purchase,
        )


__all__ = [
    "CommentAuthorDTO",
    "CommentDTO",
    "CommentDTOBuilder",
    "CommentSource",
]
