"""Comment thread service limited to first-party discussion."""

from __future__ import annotations

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, joinedload

from bit_indie_api.db.models import Comment, Game, InvoiceStatus, Purchase, User

from .dto import CommentAuthorDTO, CommentDTO, CommentDTOBuilder, CommentSource
from .verification import load_verified_user_ids


class CommentThreadService:
    """Provide helpers for listing and serializing first-party comments."""

    def __init__(self, *, dto_builder: CommentDTOBuilder | None = None) -> None:
        self._dto_builder = dto_builder or CommentDTOBuilder()

    def list_for_game(self, *, session: Session, game: Game) -> list[CommentDTO]:
        """Return chronologically sorted first-party comments for the game."""

        comments = self._load_first_party_comments(session=session, game=game)
        comments.sort(key=lambda item: (item.created_at, item.id))
        return comments

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
        records = session.scalars(stmt).all()
        user_ids = {record.user_id for record in records if record.user_id}
        verified_users = load_verified_user_ids(
            session=session, game_id=game.id, user_ids=user_ids
        )
        dtos: list[CommentDTO] = []
        for record in records:
            user = record.user
            if user is None:
                continue
            dto = self._dto_builder.build_first_party_comment(
                comment=record,
                user=user,
                is_verified_purchase=record.user_id in verified_users,
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
]
