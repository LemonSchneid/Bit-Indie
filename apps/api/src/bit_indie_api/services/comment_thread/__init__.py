"""Comment thread service composed from focused collaborators."""

from __future__ import annotations

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, joinedload

from bit_indie_api.db.models import Comment, Game, InvoiceStatus, Purchase, User

from .cache import (
    ReleaseNoteReplyCache,
    ReleaseNoteReplyLoader,
    ReleaseNoteReplySnapshot,
)
from .dto import CommentAuthorDTO, CommentDTO, CommentDTOBuilder, CommentSource
from .normalizer import NormalizedReleaseNoteReply, ReleaseNoteReplyNormalizer
from .utils import decode_npub, encode_npub
from .verification import load_verified_user_ids


class CommentThreadService:
    """Compose a merged comment timeline sourced from database records."""

    def __init__(
        self,
        *,
        reply_loader: ReleaseNoteReplyLoader | None = None,
        reply_normalizer: ReleaseNoteReplyNormalizer | None = None,
        dto_builder: CommentDTOBuilder | None = None,
        nostr_enabled: bool = True,
    ) -> None:
        self._reply_loader = reply_loader or ReleaseNoteReplyLoader()
        self._reply_normalizer = reply_normalizer or ReleaseNoteReplyNormalizer()
        self._dto_builder = dto_builder or CommentDTOBuilder()
        self._nostr_enabled = nostr_enabled

    def list_for_game(self, *, session: Session, game: Game) -> list[CommentDTO]:
        """Return chronologically sorted comments for the provided game."""

        first_party = self._load_first_party_comments(session=session, game=game)
        nostr: list[CommentDTO] = []
        if self._nostr_enabled:
            snapshots = self._reply_loader.load_snapshots(
                session=session, game_id=game.id
            )
            normalized_replies = self._reply_normalizer.normalize(
                session=session,
                game_id=game.id,
                snapshots=snapshots,
            )
            nostr = [
                self._dto_builder.build_release_note_reply(normalized_reply=reply)
                for reply in normalized_replies
            ]
        merged = [*first_party, *nostr]
        merged.sort(key=lambda item: (item.created_at, item.id))
        return merged

    def serialize_comment(self, *, session: Session, comment: Comment) -> CommentDTO:
        """Return a DTO representation for a freshly created comment."""

        user = comment.user or session.get(User, comment.user_id)
        if user is None:
            msg = "Comment must reference a persisted user before serialization."
            raise ValueError(msg)

        verified = self._has_verified_purchase(
            session=session,
            game_id=comment.game_id,
            user_id=user.id,
        )
        return self._dto_builder.build_first_party_comment(
            comment=comment,
            user=user,
            is_verified_purchase=verified,
        )

    def clear_cache(self) -> None:
        """Reset cached release note replies. Intended for tests."""

        self._reply_loader.clear_cache()

    def _load_first_party_comments(
        self, *, session: Session, game: Game
    ) -> list[CommentDTO]:
        stmt: Select[Comment] = (
            select(Comment)
            .options(joinedload(Comment.user))
            .where(Comment.game_id == game.id)
            .where(Comment.is_hidden.is_(False))
            .order_by(Comment.created_at.asc(), Comment.id.asc())
        )
        comments = session.scalars(stmt).all()
        user_ids = {comment.user_id for comment in comments if comment.user_id}
        verified_users = load_verified_user_ids(
            session=session, game_id=game.id, user_ids=user_ids
        )
        dtos: list[CommentDTO] = []
        for comment in comments:
            user = comment.user
            if user is None:
                continue
            dto = self._dto_builder.build_first_party_comment(
                comment=comment,
                user=user,
                is_verified_purchase=comment.user_id in verified_users,
            )
            dtos.append(dto)
        return dtos

    def _has_verified_purchase(
        self, *, session: Session, game_id: str, user_id: str
    ) -> bool:
        stmt = (
            select(Purchase.id)
            .where(Purchase.game_id == game_id)
            .where(Purchase.user_id == user_id)
            .where(Purchase.invoice_status == InvoiceStatus.PAID)
            .limit(1)
        )
        return session.scalar(stmt) is not None


__all__ = [
    "CommentAuthorDTO",
    "CommentDTO",
    "CommentDTOBuilder",
    "CommentSource",
    "CommentThreadService",
    "NormalizedReleaseNoteReply",
    "ReleaseNoteReplyCache",
    "ReleaseNoteReplyLoader",
    "ReleaseNoteReplySnapshot",
    "ReleaseNoteReplyNormalizer",
    "decode_npub",
    "encode_npub",
]
