"""Domain service coordinating game draft lifecycle operations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

from pydantic import AnyUrl
from sqlalchemy import Select, select
from sqlalchemy.orm import Session
from starlette import status

from bit_indie_api.db.models import BuildScanStatus, Developer, Game, User
from bit_indie_api.schemas.game import (
    GameCreateRequest,
    GamePublishChecklist,
    GamePublishRequirement,
    GamePublishRequest,
    GameUpdateRequest,
    PublishRequirementCode,
)
from bit_indie_api.services.game_promotion import update_game_featured_status
from bit_indie_api.services.game_publication import GamePublicationService
from bit_indie_api.services.malware_scanner import (
    BuildScanResult,
    BuildScanStatus as ScannerBuildScanStatus,
    MalwareScannerService,
    get_malware_scanner,
)


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


class MissingLightningAddressError(GameDraftingError):
    """Raised when a developer attempts to draft games without a payout address."""

    def __init__(self) -> None:
        super().__init__(
            "Add a Lightning address to your developer profile before submitting games.",
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


class BuildScanFailedError(GameDraftingError):
    """Raised when the malware scanner cannot complete its analysis."""

    def __init__(self, detail: str | None = None) -> None:
        message = detail or "Malware scan failed. Please try again later."
        super().__init__(message, status_code=status.HTTP_502_BAD_GATEWAY)


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


class DraftSlugValidator:
    """Ensure game draft slugs remain unique across the catalog."""

    def ensure_available(
        self,
        *,
        session: Session,
        slug: str,
        exclude_game_id: str | None = None,
    ) -> None:
        """Raise an error if the slug collides with an existing game."""

        stmt: Select[str] = select(Game.id).where(Game.slug == slug)
        if exclude_game_id is not None:
            stmt = stmt.where(Game.id != exclude_game_id)
        conflict = session.scalar(stmt)
        if conflict is not None:
            raise SlugConflictError()


class DraftPriceValidator:
    """Validate that draft prices respect Lightning invoicing constraints."""

    def validate(self, price_msats: int | None) -> None:
        """Ensure prices are non-negative and divisible by 1,000."""

        if price_msats is None:
            return
        if price_msats < 0:
            raise InvalidPriceError("Price cannot be negative.")
        if price_msats % 1000 != 0:
            raise InvalidPriceError(
                "Game price must be divisible by 1,000 milli-satoshis."
            )


class BuildMetadataValidator:
    """Confirm that uploaded build metadata remains scoped to the game."""

    def ensure_valid_key(self, *, game: Game, build_object_key: str) -> None:
        """Raise when the build key belongs to a different game namespace."""

        expected_prefix = f"games/{game.id}/build/"
        if not build_object_key.startswith(expected_prefix):
            raise InvalidBuildObjectKeyError()


class PublishRequirementsEvaluator:
    """Determine outstanding requirements preventing publication."""

    def evaluate(self, game: Game) -> list[GamePublishRequirement]:
        """Return a list of unmet publish requirements for the supplied game."""

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
        elif game.build_scan_status is not BuildScanStatus.CLEAN:
            status_message = {
                BuildScanStatus.NOT_SCANNED: "Run a malware scan on the uploaded build before publishing.",
                BuildScanStatus.PENDING: "Wait for the malware scan to finish before publishing.",
                BuildScanStatus.INFECTED: "Replace the build with a clean version. Malware was detected.",
                BuildScanStatus.FAILED: "Resolve the malware scan error before publishing.",
            }.get(
                game.build_scan_status,
                "Complete the malware scan before publishing.",
            )
            missing.append(
                GamePublishRequirement(
                    code=PublishRequirementCode.MALWARE_SCAN,
                    message=status_message,
                )
            )

        return missing


class BuildScanCoordinator:
    """Orchestrate malware scanning when build metadata changes."""

    def __init__(self, *, scanner: MalwareScannerService) -> None:
        self._scanner = scanner

    def apply(self, *, game: Game) -> None:
        """Trigger a malware scan or reset state when metadata is incomplete."""

        if not (
            game.build_object_key
            and game.build_size_bytes is not None
            and game.checksum_sha256
        ):
            game.build_scan_status = BuildScanStatus.NOT_SCANNED
            game.build_scan_message = None
            game.build_scanned_at = None
            return

        result: BuildScanResult = self._scanner.scan(
            object_key=game.build_object_key,
            size_bytes=game.build_size_bytes,
            checksum_sha256=game.checksum_sha256,
        )
        scanner_status = ScannerBuildScanStatus(result.status.value)
        game.build_scan_status = BuildScanStatus(scanner_status.value)
        game.build_scan_message = result.message
        game.build_scanned_at = datetime.now(timezone.utc)

        if scanner_status is ScannerBuildScanStatus.FAILED:
            raise BuildScanFailedError(result.message)


class GameDraftingService:
    """Encapsulate domain logic for creating, updating, and publishing game drafts."""

    def __init__(
        self,
        *,
        build_scanner: MalwareScannerService | None = None,
        slug_validator: DraftSlugValidator | None = None,
        price_validator: DraftPriceValidator | None = None,
        metadata_validator: BuildMetadataValidator | None = None,
        publish_evaluator: PublishRequirementsEvaluator | None = None,
        scan_coordinator: BuildScanCoordinator | None = None,
    ) -> None:
        """Initialize the service with injectable dependencies for testing."""

        scanner = build_scanner or get_malware_scanner()
        self._slug_validator = slug_validator or DraftSlugValidator()
        self._price_validator = price_validator or DraftPriceValidator()
        self._metadata_validator = metadata_validator or BuildMetadataValidator()
        self._publish_evaluator = publish_evaluator or PublishRequirementsEvaluator()
        self._scan_coordinator = scan_coordinator or BuildScanCoordinator(scanner=scanner)

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
        if not (developer.user and (developer.user.lightning_address or "").strip()):
            raise MissingLightningAddressError()
        self._slug_validator.ensure_available(session=session, slug=request.slug)
        self._price_validator.validate(request.price_msats)

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

        developer = game.developer
        if developer and not (developer.user and (developer.user.lightning_address or "").strip()):
            raise MissingLightningAddressError()

        updates = request.model_dump(exclude_unset=True, exclude={"user_id"})

        new_slug = updates.get("slug")
        if new_slug:
            self._slug_validator.ensure_available(
                session=session, slug=new_slug, exclude_game_id=game.id
            )

        if "price_msats" in updates:
            self._price_validator.validate(updates["price_msats"])

        new_build_key = updates.get("build_object_key")
        if new_build_key:
            self._metadata_validator.ensure_valid_key(
                game=game, build_object_key=new_build_key
            )

        build_fields = {"build_object_key", "build_size_bytes", "checksum_sha256"}
        build_metadata_updated = any(field in updates for field in build_fields)

        for field, value in updates.items():
            if isinstance(value, AnyUrl):
                value = str(value)
            setattr(game, field, value)

        if build_metadata_updated:
            self._scan_coordinator.apply(game=game)

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
        missing = self._publish_evaluator.evaluate(game)
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
        publication: GamePublicationService,
    ) -> Game:
        """Promote a draft to the unlisted catalog once requirements are met."""

        game = self.authorize_game_access(
            session=session, user_id=request.user_id, game_id=game_id
        )

        missing = list(self._publish_evaluator.evaluate(game))
        if missing:
            raise PublishRequirementsNotMetError(missing=missing)

        result = publication.publish(
            session=session,
            game=game,
        )
        return result.game

    def _refresh_featured_status(self, *, session: Session, game: Game) -> None:
        """Recalculate featured eligibility and persist any status changes."""

        changed, _ = update_game_featured_status(session=session, game=game)
        if changed:
            session.flush()
            session.refresh(game)


def get_game_drafting_service() -> GameDraftingService:
    """Return a new `GameDraftingService` instance for request-scoped operations."""

    return GameDraftingService(build_scanner=get_malware_scanner())


__all__ = [
    "GameDraftingError",
    "GameDraftingService",
    "InvalidBuildObjectKeyError",
    "BuildScanFailedError",
    "InvalidPriceError",
    "MissingDeveloperProfileError",
    "MissingLightningAddressError",
    "PublishChecklistResult",
    "PublishRequirementsNotMetError",
    "SlugConflictError",
    "UnauthorizedDeveloperError",
    "UserNotFoundError",
    "get_game_drafting_service",
    "DraftSlugValidator",
    "DraftPriceValidator",
    "BuildMetadataValidator",
    "PublishRequirementsEvaluator",
    "BuildScanCoordinator",
]
