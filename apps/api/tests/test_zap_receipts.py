"""Tests covering zap receipt ingestion via the Nostr endpoint."""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    Developer,
    Game,
    GameStatus,
    Review,
    User,
    Zap,
)
from proof_of_play_api.main import create_application
from proof_of_play_api.services.nostr import calculate_event_id, derive_xonly_public_key, schnorr_sign


ZAP_RECEIPT_KIND = 9735


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Ensure each test runs against an isolated in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Instantiate the ORM schema for tests."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    """Return a TestClient bound to a freshly created FastAPI app."""

    return TestClient(create_application())


def _seed_game_with_review() -> tuple[str, str]:
    """Persist a game and a review author, returning the review id and author pubkey."""

    with session_scope() as session:
        developer_user = User(pubkey_hex=f"dev-{uuid.uuid4().hex}")
        session.add(developer_user)
        session.flush()

        developer = Developer(user_id=developer_user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Zap Runner",
            slug=f"zap-runner-{uuid.uuid4().hex[:8]}",
            status=GameStatus.DISCOVER,
            active=True,
        )
        session.add(game)
        session.flush()

        reviewer = User(pubkey_hex=f"player-{uuid.uuid4().hex}")
        session.add(reviewer)
        session.flush()

        review = Review(
            game_id=game.id,
            user_id=reviewer.id,
            body_md="Loving the latest build!",
        )
        session.add(review)
        session.flush()

        review_id = review.id
        reviewer_pubkey = reviewer.pubkey_hex

    return review_id, reviewer_pubkey


def _sign_zap_event(
    secret_key: int,
    *,
    review_id: str,
    recipient_pubkey: str,
    amount_msats: int,
    created_at: int,
) -> dict[str, object]:
    """Construct and sign a zap receipt event payload."""

    pubkey_hex = derive_xonly_public_key(secret_key).hex()
    tags = [
        ["amount", str(amount_msats)],
        ["p", recipient_pubkey],
        ["proof-of-play-review", review_id],
    ]
    base_event = {
        "pubkey": pubkey_hex,
        "created_at": created_at,
        "kind": ZAP_RECEIPT_KIND,
        "tags": tags,
        "content": "Zap receipt",
    }
    event_id = calculate_event_id(**base_event)
    signature = schnorr_sign(bytes.fromhex(event_id), secret_key)
    return {
        **base_event,
        "id": event_id,
        "sig": signature.hex(),
    }


def test_receive_zap_receipt_updates_review_totals() -> None:
    """Processing a zap receipt should update totals and helpful score."""

    _create_schema()
    review_id, recipient_pubkey = _seed_game_with_review()
    client = _build_client()

    created_at = int(datetime.now(tz=timezone.utc).timestamp())
    payload = _sign_zap_event(
        123456789,
        review_id=review_id,
        recipient_pubkey=recipient_pubkey,
        amount_msats=10_000,
        created_at=created_at,
    )

    response = client.post("/v1/nostr/zap-receipts", json={"event": payload})

    assert response.status_code == 201
    body = response.json()
    assert body["zap"]["target_id"] == review_id
    assert body["review"]["id"] == review_id
    assert body["review"]["total_zap_msats"] == 10_000
    assert body["review"]["helpful_score"] == pytest.approx(math.log1p(10_000), rel=1e-3)

    with session_scope() as session:
        stored_review = session.get(Review, review_id)
        assert stored_review is not None
        assert stored_review.total_zap_msats == 10_000
        assert stored_review.helpful_score == pytest.approx(body["review"]["helpful_score"])
        zap_count = session.scalar(sa.select(sa.func.count()).select_from(Zap))
        assert zap_count == 1


def test_receive_multiple_zaps_accumulates_totals() -> None:
    """Zap totals should accumulate across multiple receipts for the same review."""

    _create_schema()
    review_id, recipient_pubkey = _seed_game_with_review()
    client = _build_client()

    base_time = int(datetime.now(tz=timezone.utc).timestamp())
    first_event = _sign_zap_event(
        1111,
        review_id=review_id,
        recipient_pubkey=recipient_pubkey,
        amount_msats=5_000,
        created_at=base_time,
    )
    second_event = _sign_zap_event(
        2222,
        review_id=review_id,
        recipient_pubkey=recipient_pubkey,
        amount_msats=2_500,
        created_at=base_time + 60,
    )

    first_response = client.post("/v1/nostr/zap-receipts", json={"event": first_event})
    assert first_response.status_code == 201

    second_response = client.post("/v1/nostr/zap-receipts", json={"event": second_event})
    assert second_response.status_code == 201
    body = second_response.json()

    assert body["review"]["total_zap_msats"] == 7_500
    assert body["review"]["helpful_score"] > first_response.json()["review"]["helpful_score"]

    with session_scope() as session:
        stored_review = session.get(Review, review_id)
        assert stored_review is not None
        assert stored_review.total_zap_msats == 7_500
        zap_count = session.scalar(sa.select(sa.func.count()).select_from(Zap))
        assert zap_count == 2


def test_receive_zap_receipt_rejects_duplicates() -> None:
    """Submitting the same event twice should return a conflict error."""

    _create_schema()
    review_id, recipient_pubkey = _seed_game_with_review()
    client = _build_client()

    created_at = int(datetime.now(tz=timezone.utc).timestamp())
    payload = _sign_zap_event(
        42,
        review_id=review_id,
        recipient_pubkey=recipient_pubkey,
        amount_msats=1_000,
        created_at=created_at,
    )

    first_response = client.post("/v1/nostr/zap-receipts", json={"event": payload})
    assert first_response.status_code == 201

    duplicate_response = client.post("/v1/nostr/zap-receipts", json={"event": payload})
    assert duplicate_response.status_code == 409

    with session_scope() as session:
        zap_count = session.scalar(sa.select(sa.func.count()).select_from(Zap))
        assert zap_count == 1


def test_receive_zap_receipt_requires_review_tag() -> None:
    """Events without the review tag should be rejected with a 400 error."""

    _create_schema()
    _, recipient_pubkey = _seed_game_with_review()
    client = _build_client()

    created_at = int(datetime.now(tz=timezone.utc).timestamp())
    secret_key = 987654321
    pubkey_hex = derive_xonly_public_key(secret_key).hex()
    tags = [["amount", "5000"], ["p", recipient_pubkey]]
    base_event = {
        "pubkey": pubkey_hex,
        "created_at": created_at,
        "kind": ZAP_RECEIPT_KIND,
        "tags": tags,
        "content": "Zap receipt",
    }
    event_id = calculate_event_id(**base_event)
    signature = schnorr_sign(bytes.fromhex(event_id), secret_key)
    payload = {
        **base_event,
        "id": event_id,
        "sig": signature.hex(),
    }

    response = client.post("/v1/nostr/zap-receipts", json={"event": payload})
    assert response.status_code == 400
