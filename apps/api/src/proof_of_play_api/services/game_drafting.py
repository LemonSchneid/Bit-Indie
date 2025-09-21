"""Domain service coordinating game draft lifecycle operations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from pydantic import AnyUrl
from sqlalchemy import Select, select
from sqlalchemy.orm import Session
from starlette import status

from proof_of_play_api.db.models import Developer, Game, User
from proof_of_play_api.schemas.game import (
    GameCreateRequest,
    GamePublishChecklist,
    GamePublishRequirement,
    GamePublishRequest,
    GameUpdateRequest,
    PublishRequirementCode,
)
from proof_of_play_api.services.game_promotion import update_game_featured_status
from proof_of_play_api.services.game_publication import GamePublicationService
from proof_of_play_api.services.nostr_publisher import ReleaseNotePublisher


class GameDraftingError(RuntimeError):
    """Base error raised when game drafting operations fail domain validation."""

    def __init__(self, detail: str | dict[str, object], *, status_code: int) -> None:
        super().__init__(str(detail))
        self.detail = detail
        self.status_code = status_code


class UserNotFoundError(GameDraftingError):
    """Raised when a referenced user record cannot be located."""

    def __init__(self) -> None:
        super().__init__("User not found.", status_code=status.HTTP_404_NOT_FOUND)


class MissingDeveloperProfileError(GameDraftingError):
    """Raised when a user lacks the developer profile required for drafting games."""

    def __init__(self) -> None:
        super().__init__(
            "User must have a developer profile to manage games.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class GameNotFoundError(GameDraftingError):
    """Raised when a requested game record is not present in the database."""

    def __init__(self) -> None:
        super().__init__("Game not found.", status_code=status.HTTP_404_NOT_FOUND)


class UnauthorizedDeveloperError(GameDraftingError):
    """Raised when a developer attempts to manage another developer's game."""

    def __init__(self) -> None:
        super().__init__(
            "You do not have permission to modify this game.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class SlugConflictError(GameDraftingError):
    """Raised when a requested slug collides with an existing game record."""

    def __init__(self) -> None:
        super().__init__(
            "A game with this slug already exists.",
            status_code=status.HTTP_409_CONFLICT,
        )


class InvalidBuildObjectKeyError(GameDraftingError):
    """Raised when an uploaded build key does not belong to the targeted game."""

    def __init__(self) -> None:
        super().__init__(
            "Build object key is invalid for this game.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class InvalidPriceError(GameDraftingError):
    """Raised when a price fails domain validation rules."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail, status_code=status.HTTP_400_BAD_REQUEST)


@dataclass(frozen=True)
class PublishChecklistResult:
    """Value object describing publish readiness for a game draft."""

    checklist: GamePublishChecklist
    game: Game


class PublishRequirementsNotMetError(GameDraftingError):
    """Raised when a draft has unmet requirements preventing publication."""

    def __init__(self, *, missing: Iterable[GamePublishRequirement]) -> None:
        missing_list = list(missing)
        detail = {
            "message": "Game is missing required fields for publishing.",
            "missing_requirements": [item.model_dump() for item in missing_list],
        }
        super().__init__(detail, status_code=status.HTTP_400_BAD_REQUEST)
        self.missing_requirements = missing_list


class GameDraftingService:
    """Encapsulate domain logic for creating, updating, and publishing game drafts."""

    def get_developer(self, *, session: Session, user_id: str) -> Developer:
        """Return the developer profile for a user or raise an error if unavailable."""

        user = session.get(User, user_id)
        if user is None:
            raise UserNotFoundError()

        developer = user.developer_profile
        if developer is None:
            raise MissingDeveloperProfileError()

        return developer

    def authorize_game_access(
        self, *, session: Session, user_id: str, game_id: str
    ) -> Game:
        """Return a game owned by the supplied developer, enforcing authorization."""

        developer = self.get_developer(session=session, user_id=user_id)
        game = session.get(Game, game_id)
        if game is None:
            raise GameNotFoundError()
        if game.developer_id != developer.id:
            raise UnauthorizedDeveloperError()
        return game

    def create_draft(
        self, *, session: Session, request: GameCreateRequest
    ) -> Game:
        """Persist a new draft for the requesting developer."""

        developer = self.get_developer(session=session, user_id=request.user_id)
        self._ensure_slug_available(session=session, slug=request.slug)
        self._validate_price(request.price_msats)

        payload = request.model_dump(exclude={"user_id"})
        for field, value in list(payload.items()):
            if isinstance(value, AnyUrl):
                payload[field] = str(value)

        game = Game(developer_id=developer.id, active=False, **payload)
        session.add(game)
        session.flush()
        session.refresh(game)
        return game

    def update_draft(
        self,
        *,
        session: Session,
        game_id: str,
        request: GameUpdateRequest,
    ) -> Game:
        """Apply updates to a draft owned by the requesting developer."""

        game = self.authorize_game_access(
            session=session, user_id=request.user_id, game_id=game_id
        )

        updates = request.model_dump(exclude_unset=True, exclude={"user_id"})

        new_slug = updates.get("slug")
        if new_slug:
            self._ensure_slug_available(
                session=session, slug=new_slug, exclude_game_id=game.id
            )

        if "price_msats" in updates:
            self._validate_price(updates["price_msats"])

        new_build_key = updates.get("build_object_key")
        if new_build_key:
            self._validate_build_key(game=game, build_object_key=new_build_key)

        for field, value in updates.items():
            if isinstance(value, AnyUrl):
                value = str(value)
            setattr(game, field, value)

        session.flush()
        session.refresh(game)

        self._refresh_featured_status(session=session, game=game)
        return game

    def get_publish_checklist(
        self,
        *,
        session: Session,
        user_id: str,
        game_id: str,
    ) -> PublishChecklistResult:
        """Return publish readiness details for the requesting developer's game."""

        game = self.authorize_game_access(
            session=session, user_id=user_id, game_id=game_id
        )
        missing = self._evaluate_publish_requirements(game)
        checklist = GamePublishChecklist(
            is_publish_ready=not missing, missing_requirements=list(missing)
        )
        return PublishChecklistResult(checklist=checklist, game=game)

    def publish_game(
        self,
        *,
        session: Session,
        game_id: str,
        request: GamePublishRequest,
        publisher: ReleaseNotePublisher,
        publication: GamePublicationService,
    ) -> Game:
        """Promote a draft to the unlisted catalog and dispatch release notes."""

        game = self.authorize_game_access(
            session=session, user_id=request.user_id, game_id=game_id
        )

        missing = list(self._evaluate_publish_requirements(game))
        if missing:
            raise PublishRequirementsNotMetError(missing=missing)

        result = publication.publish(
            session=session,
            game=game,
            publisher=publisher,
        )
        return result.game

    def _refresh_featured_status(self, *, session: Session, game: Game) -> None:
        """Recalculate featured eligibility and persist any status changes."""

        changed, _ = update_game_featured_status(session=session, game=game)
        if changed:
            session.flush()
            session.refresh(game)

    def _ensure_slug_available(
        self,
        *,
        session: Session,
        slug: str,
        exclude_game_id: str | None = None,
    ) -> None:
        """Raise an error when the provided slug conflicts with another game."""

        stmt: Select[str] = select(Game.id).where(Game.slug == slug)
        if exclude_game_id is not None:
            stmt = stmt.where(Game.id != exclude_game_id)
        conflict = session.scalar(stmt)
        if conflict is not None:
            raise SlugConflictError()

    def _validate_build_key(self, *, game: Game, build_object_key: str) -> None:
        """Ensure build uploads remain scoped to the owning game."""

        expected_prefix = f"games/{game.id}/build/"
        if not build_object_key.startswith(expected_prefix):
            raise InvalidBuildObjectKeyError()

    def _validate_price(self, price_msats: int | None) -> None:
        """Ensure prices are either unset or divisible by 1,000 milli-satoshis."""

        if price_msats is None:
            return
        if price_msats < 0:
            raise InvalidPriceError("Price cannot be negative.")
        if price_msats % 1000 != 0:
            raise InvalidPriceError(
                "Game price must be divisible by 1,000 milli-satoshis."
            )

    def _evaluate_publish_requirements(
        self, game: Game
    ) -> list[GamePublishRequirement]:
        """Return any unmet publish requirements for the supplied game."""

        missing: list[GamePublishRequirement] = []

        if not (game.summary and game.summary.strip()):
            missing.append(
                GamePublishRequirement(
                    code=PublishRequirementCode.SUMMARY,
                    message="Add a short summary before publishing.",
                )
            )

        if not (game.description_md and game.description_md.strip()):
            missing.append(
                GamePublishRequirement(
                    code=PublishRequirementCode.DESCRIPTION,
                    message="Provide a longer description to help players understand the game.",
                )
            )

        if not game.cover_url:
            missing.append(
                GamePublishRequirement(
                    code=PublishRequirementCode.COVER_IMAGE,
                    message="Upload a cover image to showcase the game on its listing page.",
                )
            )

        build_requirements = (
            game.build_object_key,
            game.build_size_bytes,
            game.checksum_sha256,
        )
        if not all(build_requirements):
            missing.append(
                GamePublishRequirement(
                    code=PublishRequirementCode.BUILD_UPLOAD,
                    message="Upload a downloadable build with size and checksum recorded.",
                )
            )

        return missing


def get_game_drafting_service() -> GameDraftingService:
    """Return a new `GameDraftingService` instance for request-scoped operations."""

    return GameDraftingService()


__all__ = [
    "GameDraftingError",
    "GameDraftingService",
    "InvalidBuildObjectKeyError",
    "InvalidPriceError",
    "MissingDeveloperProfileError",
    "PublishChecklistResult",
    "PublishRequirementsNotMetError",
    "SlugConflictError",
    "UnauthorizedDeveloperError",
    "UserNotFoundError",
    "get_game_drafting_service",
]
