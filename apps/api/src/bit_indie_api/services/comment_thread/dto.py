"""DTO construction helpers for storefront comments."""

from __future__ import annotations

import enum
from dataclasses import dataclass
from datetime import datetime, timezone

from bit_indie_api.db.models import Comment, User

from .normalizer import NormalizedReleaseNoteReply
from .utils import encode_npub


class CommentSource(str, enum.Enum):
    """Enumerates the possible origins for a surfaced comment."""

    FIRST_PARTY = "FIRST_PARTY"
    NOSTR = "NOSTR"


@dataclass(frozen=True)
class CommentAuthorDTO:
    """Represents public-facing metadata about the author of a comment."""

    user_id: str | None
    pubkey_hex: str | None
    npub: str | None
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
    """Construct DTOs for first-party and Nostr-sourced comments."""

    def build_first_party_comment(
        self,
        *,
        comment: Comment,
        user: User,
        is_verified_purchase: bool,
    ) -> CommentDTO:
        author = CommentAuthorDTO(
            user_id=user.id,
            pubkey_hex=user.pubkey_hex,
            npub=encode_npub(user.pubkey_hex),
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

    def build_release_note_reply(
        self,
        *,
        normalized_reply: NormalizedReleaseNoteReply,
    ) -> CommentDTO:
        snapshot = normalized_reply.snapshot
        matched_user = normalized_reply.matched_user
        author = CommentAuthorDTO(
            user_id=matched_user.id if matched_user else None,
            pubkey_hex=snapshot.pubkey_hex,
            npub=encode_npub(snapshot.pubkey_hex) if snapshot.pubkey_hex else None,
            display_name=matched_user.display_name if matched_user else None,
            lightning_address=matched_user.lightning_address if matched_user else None,
        )
        return CommentDTO(
            id=snapshot.comment_id,
            game_id=snapshot.game_id,
            body_md=snapshot.body_md,
            created_at=snapshot.created_at,
            source=CommentSource.NOSTR,
            author=author,
            is_verified_purchase=normalized_reply.is_verified_purchase,
        )


__all__ = [
    "CommentAuthorDTO",
    "CommentDTO",
    "CommentDTOBuilder",
    "CommentSource",
]
