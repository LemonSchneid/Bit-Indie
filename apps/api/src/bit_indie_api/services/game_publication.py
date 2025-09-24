"""Utilities coordinating publish and unpublish game workflows."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from bit_indie_api.db.models import Game, GameStatus
from bit_indie_api.services.game_promotion import (
    FeaturedEligibility,
    update_game_featured_status,
)
from bit_indie_api.services.nostr_publisher import ReleaseNotePublisher


@dataclass(slots=True)
class PublicationResult:
    """State captured after reconciling publish/unpublish side effects."""

    game: Game
    featured_status_changed: bool
    featured_eligibility: FeaturedEligibility


class GamePublicationService:
    """Coordinate side effects when publishing or unpublishing games."""

    def publish(
        self,
        *,
        session: Session,
        game: Game,
        publisher: ReleaseNotePublisher,
        reference: datetime | None = None,
    ) -> PublicationResult:
        """Activate a game listing and dispatch release notes."""

        game.active = True
        game.status = GameStatus.UNLISTED
        game.release_note_event_id = None
        game.release_note_published_at = None

        status_changed, eligibility = update_game_featured_status(
            session=session,
            game=game,
            reference=reference,
        )

        publisher.publish_release_note(session=session, game=game, reference=reference)

        return PublicationResult(
            game=game,
            featured_status_changed=status_changed,
            featured_eligibility=eligibility,
        )

    def unpublish(
        self,
        *,
        session: Session,
        game: Game,
        reference: datetime | None = None,
    ) -> PublicationResult:
        """Deactivate a game listing and reconcile featured placement."""

        previous_status = game.status
        game.active = False

        status_changed, eligibility = update_game_featured_status(
            session=session,
            game=game,
            reference=reference,
        )

        if game.status != GameStatus.UNLISTED:
            game.status = GameStatus.UNLISTED

        if game.status != previous_status:
            status_changed = True

        session.flush()

        return PublicationResult(
            game=game,
            featured_status_changed=status_changed,
            featured_eligibility=eligibility,
        )


def get_game_publication_service() -> GamePublicationService:
    """Return a request-scoped publication service instance."""

    return GamePublicationService()


__all__ = [
    "GamePublicationService",
    "PublicationResult",
    "get_game_publication_service",
]

