from datetime import datetime, timedelta, timezone
import uuid

import pytest

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    Developer,
    GameStatus,
    InvoiceStatus,
    Purchase,
    RefundStatus,
    Review,
    User,
)
from proof_of_play_api.schemas.game import GameCreateRequest, GameUpdateRequest
from proof_of_play_api.services.game_drafting import (
    GameDraftingService,
    InvalidPriceError,
    SlugConflictError,
)


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run each test against an isolated in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create the ORM schema for the temporary SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _create_developer(session) -> tuple[User, Developer]:
    """Persist and return a developer and their linked user."""

    user = User(pubkey_hex=f"developer-{uuid.uuid4().hex}")
    session.add(user)
    session.flush()

    developer = Developer(user_id=user.id)
    session.add(developer)
    session.flush()

    return user, developer


def test_create_draft_rejects_duplicate_slug() -> None:
    """Creating two drafts with the same slug should raise a conflict error."""

    _create_schema()
    service = GameDraftingService()

    with session_scope() as session:
        user, _ = _create_developer(session)

        request = GameCreateRequest(
            user_id=user.id,
            title="Nebula Drift",
            slug="nebula-drift",
            summary="Race through the stars.",
            price_msats=2000,
        )
        service.create_draft(session=session, request=request)

        with pytest.raises(SlugConflictError):
            service.create_draft(session=session, request=request)


def test_update_draft_rejects_invalid_price() -> None:
    """Updating a draft with a non-divisible price should fail validation."""

    _create_schema()
    service = GameDraftingService()

    with session_scope() as session:
        user, _ = _create_developer(session)
        game = service.create_draft(
            session=session,
            request=GameCreateRequest(
                user_id=user.id,
                title="Signal Cascade",
                slug="signal-cascade",
                summary="Puzzle shooter prototype.",
                price_msats=2000,
            ),
        )

        update_request = GameUpdateRequest(user_id=user.id, price_msats=1500)
        with pytest.raises(InvalidPriceError):
            service.update_draft(session=session, game_id=game.id, request=update_request)


def test_update_draft_refreshes_featured_status() -> None:
    """Refreshing a draft should toggle featured status when eligibility is met."""

    _create_schema()
    service = GameDraftingService()
    reference = datetime.now(timezone.utc)

    with session_scope() as session:
        user, _ = _create_developer(session)
        game = service.create_draft(
            session=session,
            request=GameCreateRequest(
                user_id=user.id,
                title="Aurora Tactics",
                slug="aurora-tactics",
                summary="Command squads across neon-lit arenas.",
                description_md="Fight tactical battles in procedurally generated arenas.",
                price_msats=2000,
            ),
        )

        game.active = True
        game.status = GameStatus.DISCOVER
        game.cover_url = "https://cdn.example.com/covers/aurora-tactics.png"
        game.build_object_key = f"games/{game.id}/build/build.zip"
        game.build_size_bytes = 4_194_304
        game.checksum_sha256 = "a" * 64
        game.updated_at = reference - timedelta(days=5)
        session.flush()

        for index in range(10):
            buyer = User(pubkey_hex=f"buyer-{index}-{uuid.uuid4().hex}")
            session.add(buyer)
            session.flush()

            purchase = Purchase(
                user_id=buyer.id,
                game_id=game.id,
                invoice_id=f"invoice-{index}",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=5_000,
                paid_at=reference - timedelta(days=3),
                refund_status=RefundStatus.NONE,
            )
            session.add(purchase)

            review = Review(
                game_id=game.id,
                user_id=buyer.id,
                body_md="Great tactical depth and music.",
                rating=5,
                is_verified_purchase=True,
            )
            session.add(review)

        session.flush()

        updated = service.update_draft(
            session=session,
            game_id=game.id,
            request=GameUpdateRequest(user_id=user.id, title="Aurora Tactics DX"),
        )

        assert updated.status is GameStatus.FEATURED
