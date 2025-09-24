from datetime import datetime, timedelta, timezone
import uuid

import pytest

from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import (
    BuildScanStatus,
    Developer,
    GameStatus,
    InvoiceStatus,
    Purchase,
    RefundStatus,
    Review,
    User,
)
from bit_indie_api.schemas.game import (
    GameCreateRequest,
    GamePublishRequest,
    GameUpdateRequest,
    PublishRequirementCode,
)
from bit_indie_api.services.game_drafting import (
    BuildScanFailedError,
    GameDraftingService,
    InvalidPriceError,
    PublishRequirementsNotMetError,
    SlugConflictError,
)
from bit_indie_api.services.malware_scanner import BuildScanResult
from bit_indie_api.services.game_publication import GamePublicationService


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
    user.lightning_address = "dev@ln.example.com"
    session.add(user)
    session.flush()

    developer = Developer(user_id=user.id)
    session.add(developer)
    session.flush()

    return user, developer


class _StubScanner:
    """Test double returning a fixed malware scan result."""

    def __init__(self, result: BuildScanResult) -> None:
        self._result = result
        self.calls: list[tuple[str, int, str]] = []

    def scan(
        self, *, object_key: str, size_bytes: int, checksum_sha256: str
    ) -> BuildScanResult:
        self.calls.append((object_key, size_bytes, checksum_sha256))
        return self._result


class _StubPublisher:
    """Test double that tracks release note publication attempts."""

    def __init__(self) -> None:
        self.published = 0

    def publish_release_note(self, *, session, game, reference=None) -> None:  # noqa: D401
        """Record that the publish hook would have been called."""

        self.published += 1


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


def test_update_draft_records_malware_scan_result() -> None:
    """Updating build metadata should persist the scanner status and message."""

    _create_schema()
    scanner = _StubScanner(BuildScanResult(BuildScanStatus.CLEAN, "Clean build."))
    service = GameDraftingService(build_scanner=scanner)

    with session_scope() as session:
        user, _ = _create_developer(session)
        game = service.create_draft(
            session=session,
            request=GameCreateRequest(
                user_id=user.id,
                title="Zero Horizon",
                slug="zero-horizon",
            ),
        )

        update_request = GameUpdateRequest(
            user_id=user.id,
            build_object_key=f"games/{game.id}/build/zero-horizon.zip",
            build_size_bytes=2_097_152,
            checksum_sha256="a" * 64,
        )

        updated = service.update_draft(
            session=session,
            game_id=game.id,
            request=update_request,
        )

        assert updated.build_scan_status is BuildScanStatus.CLEAN
        assert updated.build_scan_message == "Clean build."
        assert updated.build_scanned_at is not None
        assert scanner.calls == [
            (f"games/{game.id}/build/zero-horizon.zip", 2_097_152, "a" * 64)
        ]


def test_update_draft_raises_when_scan_fails() -> None:
    """A failed malware scan should abort the draft update."""

    _create_schema()
    scanner = _StubScanner(BuildScanResult(BuildScanStatus.FAILED, "Scan failed."))
    service = GameDraftingService(build_scanner=scanner)

    with session_scope() as session:
        user, _ = _create_developer(session)
        game = service.create_draft(
            session=session,
            request=GameCreateRequest(
                user_id=user.id,
                title="Ionosphere",
                slug="ionosphere",
            ),
        )

        update_request = GameUpdateRequest(
            user_id=user.id,
            build_object_key=f"games/{game.id}/build/ionosphere.zip",
            build_size_bytes=1_000_000,
            checksum_sha256="b" * 64,
        )

        with pytest.raises(BuildScanFailedError):
            service.update_draft(
                session=session,
                game_id=game.id,
                request=update_request,
            )

        assert scanner.calls == [
            (f"games/{game.id}/build/ionosphere.zip", 1_000_000, "b" * 64)
        ]


def test_publish_game_requires_clean_malware_scan() -> None:
    """Publishing should fail when the latest scan flagged malware."""

    _create_schema()
    scanner = _StubScanner(
        BuildScanResult(BuildScanStatus.INFECTED, "Malware detected.")
    )
    service = GameDraftingService(build_scanner=scanner)
    publication = GamePublicationService()
    publisher = _StubPublisher()

    with session_scope() as session:
        user, _ = _create_developer(session)
        game = service.create_draft(
            session=session,
            request=GameCreateRequest(
                user_id=user.id,
                title="Signal Break",
                slug="signal-break",
                summary="Break signals",
                description_md="## Synopsis\n\nShort wave puzzles.",
                cover_url="https://cdn.example.com/covers/signal-break.png",
            ),
        )

        update_request = GameUpdateRequest(
            user_id=user.id,
            build_object_key=f"games/{game.id}/build/signal-break.zip",
            build_size_bytes=3_145_728,
            checksum_sha256="c" * 64,
        )
        updated = service.update_draft(
            session=session,
            game_id=game.id,
            request=update_request,
        )

        assert updated.build_scan_status is BuildScanStatus.INFECTED

        publish_request = GamePublishRequest(user_id=user.id)

        with pytest.raises(PublishRequirementsNotMetError) as exc_info:
            service.publish_game(
                session=session,
                game_id=game.id,
                request=publish_request,
                publisher=publisher,
                publication=publication,
            )

        requirement_codes = {
            requirement.code for requirement in exc_info.value.missing_requirements
        }
        assert PublishRequirementCode.MALWARE_SCAN in requirement_codes
        assert publisher.published == 0
