"""Tests covering the lifecycle of game draft endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import Developer, Game, GameCategory, User
from proof_of_play_api.main import create_application
from proof_of_play_api.services.auth import reset_login_challenge_store
from proof_of_play_api.services.storage import (
    GameAssetKind,
    PresignedUpload,
    get_storage_service,
    reset_storage_service,
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


def _build_client() -> TestClient:
    """Return a FastAPI test client bound to a fresh application instance."""

    return TestClient(create_application())


def _create_user_and_developer(*, with_developer: bool) -> str:
    """Persist a user (and optionally developer profile) returning the user identifier."""

    with session_scope() as session:
        user = User(pubkey_hex="user-pubkey")
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


def test_create_game_draft_requires_developer_profile() -> None:
    """Posting a game draft should fail when the user lacks a developer profile."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=False)
    client = _build_client()

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
    client = _build_client()

    response = client.post(
        "/v1/games",
        json={
            "user_id": user_id,
            "title": "Neon Drift",
            "slug": "Neon-Drift",
            "summary": "Slide through cyber streets.",
            "price_msats": 1500,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Neon Drift"
    assert body["slug"] == "neon-drift"
    assert body["summary"] == "Slide through cyber streets."
    assert body["price_msats"] == 1500
    assert body["category"] == GameCategory.PROTOTYPE.value

    with session_scope() as session:
        stored = session.get(Game, body["id"])
        assert stored is not None
        assert stored.title == "Neon Drift"
        assert stored.slug == "neon-drift"
        assert stored.summary == "Slide through cyber streets."
        assert stored.price_msats == 1500


def test_create_game_draft_rejects_duplicate_slug() -> None:
    """Attempting to reuse a slug should return a conflict error."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client = _build_client()

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
    client = _build_client()

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


def test_update_game_draft_rejects_invalid_build_key() -> None:
    """Developers should not be able to attach arbitrary build object keys."""

    _create_schema()
    user_id = _create_user_and_developer(with_developer=True)
    client = _build_client()

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
    client = _build_client()

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
    client = _build_client()

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
    client = _build_client()

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
