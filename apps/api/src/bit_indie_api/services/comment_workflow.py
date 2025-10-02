"""Coordinate proof-of-work and rate-limiting checks for comment creation."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from bit_indie_api.db.models import Comment, Game, User
from bit_indie_api.schemas.comment import CommentCreateRequest
from bit_indie_api.services.comment_thread import CommentDTO, CommentThreadService
from bit_indie_api.services.proof_of_work import (
    ProofOfWorkValidationError,
    enforce_proof_of_work,
)
from bit_indie_api.services.rate_limiting import (
    COMMENT_RATE_LIMIT_MAX_ITEMS,
    COMMENT_RATE_LIMIT_WINDOW_SECONDS,
    RateLimitExceeded,
    enforce_rate_limit,
)


class CommentWorkflowError(Exception):
    """Base exception for comment workflow failures."""


class GameNotFoundError(CommentWorkflowError):
    """Raised when the requested game is missing or inactive."""


class UserNotFoundError(CommentWorkflowError):
    """Raised when the author user cannot be located."""


class InvalidProofOfWorkError(CommentWorkflowError):
    """Raised when the supplied proof of work payload is invalid."""


@dataclass(slots=True)
class CommentRateLimitExceeded(CommentWorkflowError):
    """Raised when the author exceeds the configured comment rate limit."""

    retry_after_seconds: int | None


class CommentWorkflow:
    """Coordinate validation, rate limiting, and persistence for comments."""

    def __init__(self, *, comment_thread_service: CommentThreadService | None = None) -> None:
        self._comment_thread_service = comment_thread_service or CommentThreadService()

    def create_comment(
        self,
        *,
        session: Session,
        game_id: str,
        request: CommentCreateRequest,
        raw_body_md: str | None,
    ) -> CommentDTO:
        """Persist a comment after verifying prerequisites and return its DTO."""

        game = session.get(Game, game_id)
        if game is None or not game.active:
            raise GameNotFoundError(game_id)

        user = session.get(User, request.user_id)
        if user is None:
            raise UserNotFoundError(request.user_id)

        payload = raw_body_md if raw_body_md is not None else request.body_md

        try:
            enforce_proof_of_work(
                user=user,
                resource_id=f"comment:{game_id}",
                payload=payload,
                proof=request.proof_of_work,
            )
        except ProofOfWorkValidationError as error:
            raise InvalidProofOfWorkError(str(error)) from error

        try:
            enforce_rate_limit(
                session=session,
                model=Comment,
                user_id=user.id,
                window_seconds=COMMENT_RATE_LIMIT_WINDOW_SECONDS,
                max_items=COMMENT_RATE_LIMIT_MAX_ITEMS,
                action="create_comment",
                resource_id=game_id,
            )
        except RateLimitExceeded as error:
            raise CommentRateLimitExceeded(
                retry_after_seconds=error.retry_after_seconds
            ) from error

        comment = Comment(game_id=game_id, user_id=user.id, body_md=request.body_md)
        comment.user = user
        session.add(comment)
        session.flush()
        session.refresh(comment)

        dto = self._comment_thread_service.serialize_comment(session=session, comment=comment)
        return dto


__all__ = [
    "CommentRateLimitExceeded",
    "CommentWorkflow",
    "CommentWorkflowError",
    "GameNotFoundError",
    "InvalidProofOfWorkError",
    "UserNotFoundError",
]
