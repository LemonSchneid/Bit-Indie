from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    Developer,
    Game,
    GameStatus,
    InvoiceStatus,
    Purchase,
    Review,
    User,
)
from proof_of_play_api.main import create_application
from proof_of_play_api.services.review_ranking import update_review_helpful_score


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Ensure each test runs against isolated database state."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create ORM tables for the in-memory SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    """Return a FastAPI client bound to a fresh application instance."""

    return TestClient(create_application())


def _seed_game(*, active: bool = True) -> str:
    """Persist a developer-owned game and return its identifier."""

    with session_scope() as session:
        developer_user = User(
            pubkey_hex=f"dev-{uuid.uuid4().hex}",
            lightning_address=f"dev{uuid.uuid4().hex[:8]}@zaps.test",
        )
        session.add(developer_user)
        session.flush()

        developer = Developer(user_id=developer_user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Starforge",
            slug=f"starforge-{uuid.uuid4().hex[:8]}",
            status=GameStatus.UNLISTED,
            active=active,
        )
        session.add(game)
        session.flush()
        game_id = game.id

    return game_id


def _create_user() -> str:
    """Persist a standalone user and return its identifier."""

    with session_scope() as session:
        user = User(
            pubkey_hex=f"user-{uuid.uuid4().hex}",
            lightning_address=f"player{uuid.uuid4().hex[:8]}@zaps.test",
        )
        session.add(user)
        session.flush()
        user_id = user.id

    return user_id


def _seed_purchase(user_id: str, game_id: str, status: InvoiceStatus) -> None:
    """Persist a purchase record with the provided invoice status."""

    with session_scope() as session:
        purchase = Purchase(
            user_id=user_id,
            game_id=game_id,
            invoice_id=f"inv-{uuid.uuid4().hex}",
            invoice_status=status,
            download_granted=status is InvoiceStatus.PAID,
        )
        if status is InvoiceStatus.PAID:
            purchase.paid_at = datetime.now(timezone.utc)
        session.add(purchase)


def test_create_review_rejects_unknown_user() -> None:
    """Submitting a review with an unknown user should return a 404 error."""

    _create_schema()
    game_id = _seed_game(active=True)
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/reviews",
        json={"user_id": "missing", "body_md": "Great build!"},
    )

    assert response.status_code == 404


def test_create_review_rejects_inactive_game() -> None:
    """Attempting to review an inactive game should return a 404 response."""

    _create_schema()
    game_id = _seed_game(active=False)
    user_id = _create_user()
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/reviews",
        json={"user_id": user_id, "body_md": "Looking forward to it"},
    )

    assert response.status_code == 404


def test_create_review_disallows_rating_without_verified_purchase() -> None:
    """Providing a rating without a paid purchase should yield a 400 response."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/reviews",
        json={"user_id": user_id, "body_md": "Fun loop", "rating": 5},
    )

    assert response.status_code == 400


def test_create_review_allows_rating_with_verified_purchase() -> None:
    """Users with a paid purchase should be able to submit a rating."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()
    _seed_purchase(user_id=user_id, game_id=game_id, status=InvoiceStatus.PAID)
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/reviews",
        json={
            "user_id": user_id,
            "title": "Great update",
            "body_md": "  Combat feels tight now.  ",
            "rating": 4,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["game_id"] == game_id
    assert body["user_id"] == user_id
    assert body["title"] == "Great update"
    assert body["body_md"] == "Combat feels tight now."
    assert body["rating"] == 4
    assert body["is_verified_purchase"] is True
    assert body["helpful_score"] == pytest.approx(0.0)
    assert body["total_zap_msats"] == 0
    assert body["author"]["id"] == user_id
    assert body["author"]["pubkey_hex"].startswith("user-")
    assert body["author"]["lightning_address"].endswith("@zaps.test")
    assert body["author"]["display_name"] is None

    with session_scope() as session:
        stored = session.get(Review, body["id"])
        assert stored is not None
        assert stored.rating == 4
        assert stored.is_verified_purchase is True
        assert stored.helpful_score == pytest.approx(0.0)
        assert stored.total_zap_msats == 0


def test_create_review_without_purchase_sets_flag_false() -> None:
    """Reviews without a purchase should be stored without a verified flag."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/reviews",
        json={"user_id": user_id, "body_md": "Still rough but promising"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["rating"] is None
    assert body["is_verified_purchase"] is False
    assert body["helpful_score"] == pytest.approx(0.0)
    assert body["total_zap_msats"] == 0
    assert body["author"]["id"] == user_id
    assert body["author"]["lightning_address"].endswith("@zaps.test")


def test_list_reviews_orders_by_helpful_score() -> None:
    """Listing reviews should prioritise helpful score over recency."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()

    older_created = datetime(2024, 2, 1, 12, 0, tzinfo=timezone.utc)
    newer_created = datetime(2024, 3, 5, 18, 30, tzinfo=timezone.utc)

    with session_scope() as session:
        user = session.get(User, user_id)
        assert user is not None
        user.nip05 = f"{user.pubkey_hex}@example.com"

        first = Review(
            game_id=game_id,
            user_id=user_id,
            body_md="Solid patch",
            rating=4,
            is_verified_purchase=True,
            created_at=older_created,
        )
        second = Review(
            game_id=game_id,
            user_id=user_id,
            body_md="Needs work",
            rating=None,
            is_verified_purchase=False,
            created_at=newer_created,
        )
        session.add_all([first, second])
        session.flush()

        update_review_helpful_score(first, user=user, total_zap_msats=50_000)
        update_review_helpful_score(second, user=user, total_zap_msats=1_000)
        session.flush()
        session.refresh(first)
        session.refresh(second)
        assert first.total_zap_msats == 50_000
        assert second.total_zap_msats == 1_000

    client = _build_client()
    response = client.get(f"/v1/games/{game_id}/reviews")

    assert response.status_code == 200
    body = response.json()
    assert [item["body_md"] for item in body] == ["Solid patch", "Needs work"]
    assert body[0]["helpful_score"] > body[1]["helpful_score"]
    assert body[0]["created_at"] < body[1]["created_at"]
    assert body[0]["total_zap_msats"] == 50_000
    assert body[1]["total_zap_msats"] == 1_000
    assert body[0]["author"]["lightning_address"].endswith("@zaps.test")
