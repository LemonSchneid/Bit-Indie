"""Tests covering the lifecycle of game draft endpoints."""

from __future__ import annotations

from itertools import count

import pytest
from datetime import datetime, timedelta, timezone
import uuid

from fastapi.testclient import TestClient

from sqlalchemy import select

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    BuildScanStatus,
    Developer,
    Game,
    GameCategory,
    GameStatus,
    InvoiceStatus,
    Purchase,
    RefundStatus,
    Review,
    User,
)
from proof_of_play_api.main import create_application
from proof_of_play_api.schemas.game import PublishRequirementCode
from proof_of_play_api.services.auth import reset_login_challenge_store
from proof_of_play_api.services.storage import (
    GameAssetKind,
    PresignedUpload,
    get_storage_service,
    reset_storage_service,
)
from proof_of_play_api.services.nostr_publisher import (
    PublishOutcome,
    get_release_note_publisher,
)


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Run each test against isolated database and login challenge store instances."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    reset_login_challenge_store()
    reset_storage_service()
    yield
    reset_database_state()
    reset_login_challenge_store()
    reset_storage_service()


def _create_schema() -> None:
    """Create all ORM tables for the in-memory test database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> tuple[TestClient, _DummyReleaseNotePublisher]:
    """Return a FastAPI test client bound to a fresh application instance."""

    app = create_application()
    publisher = _DummyReleaseNotePublisher()
    app.dependency_overrides[get_release_note_publisher] = lambda: publisher
    return TestClient(app), publisher


def test_list_catalog_games_returns_publicly_visible_entries() -> None:
    """GET /v1/games should return active discoverable and featured listings."""

    _create_schema()

    with session_scope() as session:
        developer_user = User(
            pubkey_hex="catalog-dev-pubkey",
            lightning_address="orbit@example.com",
        )
        session.add(developer_user)
        session.flush()

        developer = Developer(user_id=developer_user.id, user=developer_user)
        session.add(developer)
        session.flush()

        discover_game = Game(
            developer=developer,
            status=GameStatus.DISCOVER,
            title="Discover Orbit",
            slug="discover-orbit",
            summary="A discoverable roguelite.",
            price_msats=150_000,
            cover_url="https://example.com/discover.png",
            category=GameCategory.EARLY_ACCESS,
            build_object_key=None,
            build_size_bytes=None,
            checksum_sha256=None,
            active=True,
        )
        featured_game = Game(
            developer=developer,
            status=GameStatus.FEATURED,
            title="Featured Orbit",
            slug="featured-orbit",
            summary="A headliner entry.",
            price_msats=210_000,
            cover_url="https://example.com/featured.png",
            category=GameCategory.FINISHED,
            build_object_key=None,
            build_size_bytes=None,
            checksum_sha256=None,
            active=True,
        )
        hidden_game = Game(
            developer=developer,
            status=GameStatus.UNLISTED,
            title="Hidden Orbit",
            slug="hidden-orbit",
            summary="Should not appear.",
            active=True,
        )
        inactive_game = Game(
            developer=developer,
            status=GameStatus.FEATURED,
            title="Offline Orbit",
            slug="offline-orbit",
            summary="Inactive listing.",
            active=False,
        )

        session.add_all([discover_game, featured_game, hidden_game, inactive_game])
        session.flush()

        discover_game.updated_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
        featured_game.updated_at = datetime(2024, 2, 1, tzinfo=timezone.utc)

    client, _ = _build_client()

    response = client.get("/v1/games")

    assert response.status_code == 200
    body = response.json()
    assert [game["slug"] for game in body] == ["featured-orbit", "discover-orbit"]
    assert body[0]["status"] == "FEATURED"
    assert body[1]["status"] == "DISCOVER"
    assert body[0]["developer_lightning_address"] == "orbit@example.com"


_user_pubkey_sequence = count()


def _create_user_and_developer(*, with_developer: bool) -> str:
    """Persist a user (and optionally developer profile) returning the user identifier."""

    with session_scope() as session:
        user = User(pubkey_hex=f"user-pubkey-{next(_user_pubkey_sequence)}")
        session.add(user)
        session.flush()
        user_id = user.id

        if with_developer:
            developer = Developer(user_id=user_id)
            session.add(developer)

    return user_id


class _DummyStorageService:
    """Test double for the storage service that records invocations."""

    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def generate_game_asset_upload(
        self,
        *,
        game_id: str,
        asset: GameAssetKind,
        filename: str,
        content_type: str | None = None,
        max_bytes: int | None = None,
    ) -> PresignedUpload:
        self.calls.append(
            {
                "game_id": game_id,
                "asset": asset,
                "filename": filename,
                "content_type": content_type,
                "max_bytes": max_bytes,
            }
        )
        return PresignedUpload(
            upload_url="http://localhost:9000/pop-games",
            fields={"key": "generated", "Content-Type": content_type or "application/octet-stream"},
            object_key="games/identifier/build/generated.bin",
            public_url="http://localhost:9000/pop-games/games/identifier/build/generated.bin",
        )


class _DummyReleaseNotePublisher:
    """Test double that simulates release note publication."""

    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def publish_release_note(
        self,
        *,
        session,
        game,
        reference: datetime | None = None,
    ) -> PublishOutcome:
        published_at = reference or datetime.now(timezone.utc)
        if published_at.tzinfo is None:
            published_at = published_at.replace(tzinfo=timezone.utc)

        event_id = f"event-{uuid.uuid4().hex}"
        event = {
            "id": event_id,
            "pubkey": "stub-pubkey",
            "created_at": int(published_at.timestamp()),
            "kind": 30023,
            "tags": [],
            "content": game.description_md or "",
        }

        game.release_note_event_id = event_id
        game.release_note_published_at = published_at
        self.calls.append({"game_id": game.id, "event": event})
        session.flush()
        return PublishOutcome(event=event, successful_relays=("stub",), failed_relays=())


def test_create_game_draft_requires_developer_profile() -> None:
    """Posting a game draft should fail when the user lacks a developer profile."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=False)
    client, release_publisher = _build_client()

    response = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Space Odyssey",
            "slug": "space-odyssey",
        },
    )

    assert response.status_code == 400


def test_create_game_draft_persists_and_returns_payload() -> None:
    """Creating a game draft should persist the record and return the stored payload."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client, _ = _build_client()

    response = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Neon Drift",
            "slug": "Neon-Drift",
            "summary": "Slide through cyber streets.",
            "price_msats": 2000,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Neon Drift"
    assert body["slug"] == "neon-drift"
    assert body["summary"] == "Slide through cyber streets."
    assert body["price_msats"] == 2000
    assert body["active"] is False
    assert body["category"] == GameCategory.PROTOTYPE.value

    with session_scope() as session:
        stored = session.get(Game, body["id"])
        assert stored is not None
        assert stored.title == "Neon Drift"
        assert stored.slug == "neon-drift"
        assert stored.summary == "Slide through cyber streets."
        assert stored.price_msats == 2000
        assert stored.active is False


def test_create_game_draft_rejects_duplicate_slug() -> None:
    """Attempting to reuse a slug should return a conflict error."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client, _ = _build_client()

    first = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Echo Valley",
            "slug": "echo-valley",
        },
    )
    assert first.status_code == 201

    second = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Echo Valley Remix",
            "slug": "echo-valley",
        },
    )

    assert second.status_code == 409


def test_update_game_draft_applies_changes() -> None:
    """Updating a draft should persist the supplied field changes."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client, _ = _build_client()

    created = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Quantum Trails",
            "slug": "quantum-trails",
            "summary": "Initial summary.",
        },
    )
    assert created.status_code == 201
    game_id = created.json()["id"]

    update = client.put(
        f"/v1/games/{game_id}",
        json={
            "user_id": user_id,
            "title": "Quantum Trails DX",
            "slug": "quantum-trails-dx",
            "summary": None,
            "category": GameCategory.EARLY_ACCESS.value,
            "build_object_key": f"games/{game_id}/build/build.zip",
            "build_size_bytes": 4096,
            "checksum_sha256": "a" * 64,
        },
    )

    assert update.status_code == 200
    body = update.json()
    assert body["title"] == "Quantum Trails DX"
    assert body["slug"] == "quantum-trails-dx"
    assert body["summary"] is None
    assert body["category"] == GameCategory.EARLY_ACCESS.value
    assert body["build_object_key"] == f"games/{game_id}/build/build.zip"
    assert body["build_size_bytes"] == 4096
    assert body["checksum_sha256"] == "a" * 64
    assert body["build_scan_status"] == BuildScanStatus.CLEAN.value
    assert body["build_scan_message"] == "No malware detected in build metadata."
    assert body["build_scanned_at"] is not None

    with session_scope() as session:
        stored = session.get(Game, game_id)
        assert stored is not None
        assert stored.title == "Quantum Trails DX"
        assert stored.slug == "quantum-trails-dx"
        assert stored.summary is None
        assert stored.category == GameCategory.EARLY_ACCESS
        assert stored.build_object_key == f"games/{game_id}/build/build.zip"
        assert stored.build_size_bytes == 4096
        assert stored.checksum_sha256 == "a" * 64
        assert stored.build_scan_status is BuildScanStatus.CLEAN
        assert stored.build_scan_message == "No malware detected in build metadata."
        assert stored.build_scanned_at is not None


def test_update_game_draft_rejects_invalid_build_key() -> None:
    """Developers should not be able to attach arbitrary build object keys."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client, _ = _build_client()

    created = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Sky Forge",
            "slug": "sky-forge",
        },
    )
    assert created.status_code == 201
    game_id = created.json()["id"]

    response = client.put(
        f"/v1/games/{game_id}",
        json={
            "user_id": user_id,
            "build_object_key": "games/other/build/file.zip",
        },
    )

    assert response.status_code == 400


def test_update_game_draft_rejects_other_developers() -> None:
    """A developer should not be able to modify another developer's draft."""

    _create_schema()
    owner_id = _create_user_and_developer(with_developer=True)
    intruder_id = _create_user_and_developer(with_developer=True)
    client, _ = _build_client()

    created = client.post(
        "/v1/games",
        json={
            "user_id": owner_id,
            "title": "Starlight",
            "slug": "starlight",
        },
    )
    assert created.status_code == 201
    game_id = created.json()["id"]

    response = client.put(
        f"/v1/games/{game_id}",
        json={
            "user_id": intruder_id,
            "title": "Starlight Deluxe",
        },
    )

    assert response.status_code == 403


def test_create_game_asset_upload_returns_presigned_payload() -> None:
    """Developers should receive pre-signed data for uploading game assets."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client, _ = _build_client()

    created = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Aurora Bloom",
            "slug": "aurora-bloom",
        },
    )
    assert created.status_code == 201
    game_id = created.json()["id"]

    dummy = _DummyStorageService()
    client.app.dependency_overrides[get_storage_service] = lambda: dummy

    response = client.post(
        f"/v1/games/{game_id}/uploads/{GameAssetKind.BUILD.value}",
        json={
            "user_id": user_id,
            "filename": "build.zip",
            "content_type": "application/zip",
            "max_bytes": 1024,
        },
    )

    client.app.dependency_overrides.clear()
    client.app.dependency_overrides[get_release_note_publisher] = lambda: release_publisher
    client.app.dependency_overrides[get_release_note_publisher] = lambda: release_publisher

    assert response.status_code == 200
    body = response.json()
    assert body["upload_url"] == "http://localhost:9000/pop-games"
    assert body["object_key"] == "games/identifier/build/generated.bin"
    assert body["public_url"].endswith("generated.bin")
    assert dummy.calls
    recorded = dummy.calls[0]
    assert recorded["game_id"] == game_id
    assert recorded["asset"] == GameAssetKind.BUILD
    assert recorded["filename"] == "build.zip"
    assert recorded["content_type"] == "application/zip"
    assert recorded["max_bytes"] == 1024


def test_create_game_asset_upload_rejects_other_developers() -> None:
    """Only the owning developer should be able to generate upload credentials."""

    _create_schema()
    owner_id = _create_user_and_developer(with_developer=True)
    intruder_id = _create_user_and_developer(with_developer=True)
    client, release_publisher = _build_client()

    created = client.post(
        "/v1/games",
        json={
            "user_id": owner_id,
            "title": "Celestial Grid",
            "slug": "celestial-grid",
        },
    )
    assert created.status_code == 201
    game_id = created.json()["id"]

    dummy = _DummyStorageService()
    client.app.dependency_overrides[get_storage_service] = lambda: dummy

    response = client.post(
        f"/v1/games/{game_id}/uploads/{GameAssetKind.COVER.value}",
        json={
            "user_id": intruder_id,
            "filename": "cover.png",
        },
    )

    client.app.dependency_overrides.clear()

    assert response.status_code == 403
    assert not dummy.calls


def test_get_publish_checklist_returns_missing_requirements() -> None:
    """The publish checklist should enumerate unmet requirements for a draft."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client, release_publisher = _build_client()

    created = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Solar Winds",
            "slug": "solar-winds",
        },
    )
    assert created.status_code == 201
    game_id = created.json()["id"]

    checklist = client.get(
        f"/v1/games/{game_id}/publish-checklist",
        params={"user_id": user_id},
    )

    assert checklist.status_code == 200
    payload = checklist.json()
    assert payload["is_publish_ready"] is False
    codes = {item["code"] for item in payload["missing_requirements"]}
    assert PublishRequirementCode.SUMMARY.value in codes
    assert PublishRequirementCode.DESCRIPTION.value in codes
    assert PublishRequirementCode.COVER_IMAGE.value in codes
    assert PublishRequirementCode.BUILD_UPLOAD.value in codes


def test_publish_game_rejects_incomplete_draft() -> None:
    """Attempting to publish without meeting the checklist should fail."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client, release_publisher = _build_client()

    created = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Lunar Drift",
            "slug": "lunar-drift",
        },
    )
    assert created.status_code == 201
    game_id = created.json()["id"]

    publish = client.post(
        f"/v1/games/{game_id}/publish",
        json={"user_id": user_id},
    )

    assert publish.status_code == 400
    detail = publish.json()["detail"]
    codes = {item["code"] for item in detail["missing_requirements"]}
    assert PublishRequirementCode.SUMMARY.value in codes
    assert PublishRequirementCode.DESCRIPTION.value in codes
    assert PublishRequirementCode.COVER_IMAGE.value in codes
    assert PublishRequirementCode.BUILD_UPLOAD.value in codes


def test_publish_game_activates_listing_and_enables_slug_lookup() -> None:
    """Publishing should mark the game active and allow lookups by slug."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client, release_publisher = _build_client()

    created = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Nebula Riders",
            "slug": "nebula-riders",
        },
    )
    assert created.status_code == 201
    created_body = created.json()
    game_id = created_body["id"]

    # Drafts should not be publicly accessible until published.
    not_listed = client.get("/v1/games/slug/nebula-riders")
    assert not_listed.status_code == 404

    update = client.put(
        f"/v1/games/{game_id}",
        json={
            "user_id": user_id,
            "summary": "High-speed hover bike racing across the stars.",
            "description_md": "Race solo or with friends in procedurally generated tracks.",
            "cover_url": "https://cdn.example.com/covers/nebula-riders.png",
            "build_object_key": f"games/{game_id}/build/nebula-riders.zip",
            "build_size_bytes": 2_097_152,
            "checksum_sha256": "b" * 64,
        },
    )
    assert update.status_code == 200

    publish = client.post(
        f"/v1/games/{game_id}/publish",
        json={"user_id": user_id},
    )

    assert publish.status_code == 200
    published_body = publish.json()
    assert published_body["active"] is True
    assert published_body["status"] == GameStatus.UNLISTED.value
    assert published_body["release_note_event_id"] is not None
    assert published_body["release_note_published_at"] is not None
    assert release_publisher.calls

    by_slug = client.get("/v1/games/slug/Nebula-Riders")
    assert by_slug.status_code == 200
    slug_body = by_slug.json()
    assert slug_body["id"] == game_id
    assert slug_body["title"] == "Nebula Riders"
    assert slug_body["release_note_event_id"] == published_body["release_note_event_id"]

    with session_scope() as session:
        stored = session.get(Game, game_id)
        assert stored is not None
        assert stored.release_note_event_id == published_body["release_note_event_id"]
        assert stored.release_note_published_at is not None

def test_list_featured_games_returns_eligible_entries() -> None:
    """The featured games endpoint should surface games that meet the rotation criteria."""

    _create_schema()
    client, release_publisher = _build_client()
    reference = datetime.now(timezone.utc)

    with session_scope() as session:
        developer_user = User(pubkey_hex="dev-featured")
        session.add(developer_user)
        session.flush()

        developer = Developer(user_id=developer_user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Aurora Tactics",
            slug="aurora-tactics",
            summary="Command squads across neon-lit arenas.",
            active=True,
            status=GameStatus.DISCOVER,
            updated_at=reference - timedelta(days=10),
        )
        session.add(game)
        session.flush()

        for index in range(10):
            buyer = User(pubkey_hex=f"buyer-{index}")
            session.add(buyer)
            session.flush()

            purchase = Purchase(
                user_id=buyer.id,
                game_id=game.id,
                invoice_id=f"inv-{index}",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=2_000,
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
        session.refresh(game)
        game.updated_at = reference - timedelta(days=10)
        session.flush()
        game_id = game.id

    response = client.get("/v1/games/featured")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    entry = body[0]
    assert entry["game"]["slug"] == "aurora-tactics"
    assert entry["verified_review_count"] == 10
    assert entry["paid_purchase_count"] == 10
    assert entry["refund_rate"] == pytest.approx(0.0)
    assert entry["updated_within_window"] is True

    with session_scope() as session:
        stored = session.get(Game, game_id)
        assert stored is not None
        assert stored.status is GameStatus.FEATURED


def test_list_featured_games_excludes_games_failing_refund_threshold() -> None:
    """Games breaching refund thresholds should be demoted and hidden from the featured list."""

    _create_schema()
    client, release_publisher = _build_client()
    reference = datetime.now(timezone.utc)

    with session_scope() as session:
        developer_user = User(pubkey_hex="dev-demote")
        session.add(developer_user)
        session.flush()

        developer = Developer(user_id=developer_user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Spectral Speedway",
            slug="spectral-speedway",
            active=True,
            status=GameStatus.FEATURED,
            updated_at=reference - timedelta(days=6),
        )
        session.add(game)
        session.flush()

        for index in range(12):
            buyer = User(pubkey_hex=f"refund-buyer-{index}")
            session.add(buyer)
            session.flush()

            purchase = Purchase(
                user_id=buyer.id,
                game_id=game.id,
                invoice_id=f"refund-inv-{index}",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=4_000,
                paid_at=reference - timedelta(days=4),
                refund_status=RefundStatus.NONE,
            )
            session.add(purchase)

            review = Review(
                game_id=game.id,
                user_id=buyer.id,
                body_md="Fast but buggy build.",
                rating=3,
                is_verified_purchase=True,
            )
            session.add(review)

        refund_ids = session.scalars(
            select(Purchase.id).where(Purchase.game_id == game.id).limit(3)
        ).all()
        for purchase_id in refund_ids:
            purchase = session.get(Purchase, purchase_id)
            assert purchase is not None
            purchase.refund_status = RefundStatus.PAID

        session.flush()
        session.refresh(game)
        game.updated_at = reference - timedelta(days=6)
        session.flush()
        game_id = game.id

    response = client.get("/v1/games/featured")
    assert response.status_code == 200
    body = response.json()
    assert body == []

    with session_scope() as session:
        stored = session.get(Game, game_id)
        assert stored is not None
        assert stored.status is GameStatus.DISCOVER


def test_list_featured_games_updates_status_for_results_beyond_limit() -> None:
    """Games later in the rotation should still be re-evaluated for featured status."""

    _create_schema()
    client, release_publisher = _build_client()
    reference = datetime.now(timezone.utc)

    with session_scope() as session:
        developer_user = User(pubkey_hex="dev-rotation")
        session.add(developer_user)
        session.flush()

        developer = Developer(user_id=developer_user.id)
        session.add(developer)
        session.flush()

        fresh_game = Game(
            developer_id=developer.id,
            title="Stellar Blitz",
            slug="stellar-blitz",
            active=True,
            status=GameStatus.FEATURED,
            updated_at=reference - timedelta(days=5),
        )
        stale_game = Game(
            developer_id=developer.id,
            title="Ancient Arena",
            slug="ancient-arena",
            active=True,
            status=GameStatus.FEATURED,
            updated_at=reference - timedelta(days=40),
        )
        session.add_all([fresh_game, stale_game])
        session.flush()

        for game_index, game in enumerate((fresh_game, stale_game)):
            for entry_index in range(10):
                buyer = User(pubkey_hex=f"limit-buyer-{game_index}-{entry_index}")
                session.add(buyer)
                session.flush()

                purchase = Purchase(
                    user_id=buyer.id,
                    game_id=game.id,
                    invoice_id=f"limit-inv-{game_index}-{entry_index}",
                    invoice_status=InvoiceStatus.PAID,
                    amount_msats=3_000,
                    paid_at=reference - timedelta(days=2),
                    refund_status=RefundStatus.NONE,
                )
                session.add(purchase)

                review = Review(
                    game_id=game.id,
                    user_id=buyer.id,
                    body_md="Dependably fun matches.",
                    rating=4,
                    is_verified_purchase=True,
                )
                session.add(review)

        session.flush()
        session.refresh(fresh_game)
        session.refresh(stale_game)
        fresh_game.updated_at = reference - timedelta(days=5)
        stale_game.updated_at = reference - timedelta(days=40)
        session.flush()
        fresh_game_id = fresh_game.id
        stale_game_id = stale_game.id

    response = client.get("/v1/games/featured", params={"limit": 1})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    entry = body[0]
    assert entry["game"]["slug"] == "stellar-blitz"

    with session_scope() as session:
        fresh = session.get(Game, fresh_game_id)
        stale = session.get(Game, stale_game_id)
        assert fresh is not None
        assert stale is not None
        assert fresh.status is GameStatus.FEATURED
        assert stale.status is GameStatus.DISCOVER
