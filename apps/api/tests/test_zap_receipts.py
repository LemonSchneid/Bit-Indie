"""Tests covering zap receipt ingestion via the Nostr endpoint."""

from __future__ import annotations

import builtins
import math
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

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
from proof_of_play_api.services.review_ranking import compute_review_helpful_score


NOSTR_ENABLED = os.getenv("NOSTR_ENABLED", "false").lower() == "true"

pytestmark = pytest.mark.skipif(
    not NOSTR_ENABLED,
    reason="Nostr features are disabled for the Simple MVP",
)


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


def _seed_game_with_review(
    *, reviewer_pubkey: str | None = None, developer_pubkey: str | None = None
) -> tuple[str, str, str]:
    """Persist a game and review author, returning ids and associated pubkeys."""

    with session_scope() as session:
        if developer_pubkey is None:
            developer_pubkey = f"dev-{uuid.uuid4().hex}"
        developer_user = User(pubkey_hex=developer_pubkey)
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

        if reviewer_pubkey is None:
            reviewer_pubkey = f"player-{uuid.uuid4().hex}"
        reviewer = User(pubkey_hex=reviewer_pubkey)
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
        developer_pubkey = developer_user.pubkey_hex

    return review_id, reviewer_pubkey, developer_pubkey


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
    review_id, recipient_pubkey, _ = _seed_game_with_review()
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
    assert body["review"]["suspicious_zap_pattern"] is False
    assert body["review"]["helpful_score"] == pytest.approx(math.log1p(10_000), rel=1e-3)

    with session_scope() as session:
        stored_review = session.get(Review, review_id)
        assert stored_review is not None
        assert stored_review.total_zap_msats == 10_000
        assert stored_review.suspicious_zap_pattern is False
        assert stored_review.helpful_score == pytest.approx(body["review"]["helpful_score"])
        zap_count = session.scalar(sa.select(sa.func.count()).select_from(Zap))
        assert zap_count == 1


def test_receive_multiple_zaps_accumulates_totals() -> None:
    """Zap totals should accumulate across multiple receipts for the same review."""

    _create_schema()
    review_id, recipient_pubkey, _ = _seed_game_with_review()
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
    assert body["review"]["suspicious_zap_pattern"] is False
    assert body["review"]["helpful_score"] > first_response.json()["review"]["helpful_score"]


def test_receive_zap_receipt_casts_total_msats_to_int(monkeypatch) -> None:
    """Zap totals should be coerced to integers before updating rankings."""

    _create_schema()
    review_id, recipient_pubkey, _ = _seed_game_with_review()
    client = _build_client()

    real_sum = builtins.sum

    def _decimal_sum(values):
        return Decimal(real_sum(values))

    monkeypatch.setattr(builtins, "sum", _decimal_sum)

    created_at = int(datetime.now(tz=timezone.utc).timestamp())
    payload = _sign_zap_event(
        3333,
        review_id=review_id,
        recipient_pubkey=recipient_pubkey,
        amount_msats=7_000,
        created_at=created_at,
    )

    response = client.post("/v1/nostr/zap-receipts", json={"event": payload})

    assert response.status_code == 201
    body = response.json()
    assert body["review"]["total_zap_msats"] == 7_000

    with session_scope() as session:
        stored_review = session.get(Review, review_id)
        assert stored_review is not None
        assert stored_review.total_zap_msats == 7_000
        zap_count = session.scalar(sa.select(sa.func.count()).select_from(Zap))
        assert zap_count == 1


def test_receive_zap_receipt_rejects_duplicates() -> None:
    """Submitting the same event twice should return a conflict error."""

    _create_schema()
    review_id, recipient_pubkey, _ = _seed_game_with_review()
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
    _, recipient_pubkey, _ = _seed_game_with_review()
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


def test_self_zap_receipt_excluded_from_totals() -> None:
    """Zaps from the review author should be recorded but not counted."""

    _create_schema()
    reviewer_secret = 17_123
    reviewer_pubkey = derive_xonly_public_key(reviewer_secret).hex()
    review_id, recipient_pubkey, _ = _seed_game_with_review(
        reviewer_pubkey=reviewer_pubkey
    )
    client = _build_client()

    created_at = int(datetime.now(tz=timezone.utc).timestamp())
    payload = _sign_zap_event(
        reviewer_secret,
        review_id=review_id,
        recipient_pubkey=recipient_pubkey,
        amount_msats=5_000,
        created_at=created_at,
    )

    response = client.post("/v1/nostr/zap-receipts", json={"event": payload})
    assert response.status_code == 201
    body = response.json()
    assert body["review"]["total_zap_msats"] == 0
    assert body["review"]["suspicious_zap_pattern"] is False
    assert body["review"]["helpful_score"] == pytest.approx(0.0)

    with session_scope() as session:
        stored_review = session.get(Review, review_id)
        assert stored_review is not None
        assert stored_review.total_zap_msats == 0
        assert stored_review.suspicious_zap_pattern is False
        assert stored_review.helpful_score == pytest.approx(0.0)
        zap_count = session.scalar(sa.select(sa.func.count()).select_from(Zap))
        assert zap_count == 1


def test_developer_self_zap_receipt_excluded_from_totals() -> None:
    """Zaps from the owning developer should not influence totals."""

    _create_schema()
    reviewer_secret = 31_415
    reviewer_pubkey = derive_xonly_public_key(reviewer_secret).hex()
    developer_secret = 27_182
    developer_pubkey = derive_xonly_public_key(developer_secret).hex()
    review_id, recipient_pubkey, stored_dev_pubkey = _seed_game_with_review(
        reviewer_pubkey=reviewer_pubkey, developer_pubkey=developer_pubkey
    )
    assert stored_dev_pubkey == developer_pubkey
    client = _build_client()

    created_at = int(datetime.now(tz=timezone.utc).timestamp())
    payload = _sign_zap_event(
        developer_secret,
        review_id=review_id,
        recipient_pubkey=recipient_pubkey,
        amount_msats=7_500,
        created_at=created_at,
    )

    response = client.post("/v1/nostr/zap-receipts", json={"event": payload})
    assert response.status_code == 201
    body = response.json()
    assert body["review"]["total_zap_msats"] == 0
    assert body["review"]["suspicious_zap_pattern"] is False
    assert body["review"]["helpful_score"] == pytest.approx(0.0)

    with session_scope() as session:
        stored_review = session.get(Review, review_id)
        assert stored_review is not None
        assert stored_review.total_zap_msats == 0
        assert stored_review.suspicious_zap_pattern is False
        assert stored_review.helpful_score == pytest.approx(0.0)
        zap_amount = session.scalar(
            sa.select(sa.func.sum(Zap.amount_msats)).where(Zap.target_id == review_id)
        )
        assert zap_amount == 7_500


def test_correlation_guard_flags_dominant_zapper() -> None:
    """A dominant zapper should trigger the suspicious flag and penalty."""

    _create_schema()
    reviewer_secret = 51_234
    reviewer_pubkey = derive_xonly_public_key(reviewer_secret).hex()
    developer_secret = 61_234
    developer_pubkey = derive_xonly_public_key(developer_secret).hex()
    review_id, recipient_pubkey, _ = _seed_game_with_review(
        reviewer_pubkey=reviewer_pubkey, developer_pubkey=developer_pubkey
    )
    client = _build_client()

    base_time = int(datetime.now(tz=timezone.utc).timestamp())
    zapper_secret = 71_234
    events = [
        _sign_zap_event(
            zapper_secret,
            review_id=review_id,
            recipient_pubkey=recipient_pubkey,
            amount_msats=2_000,
            created_at=base_time + offset,
        )
        for offset in (0, 30, 60)
    ]

    for payload in events[:2]:
        interim = client.post("/v1/nostr/zap-receipts", json={"event": payload})
        assert interim.status_code == 201
        assert interim.json()["review"]["suspicious_zap_pattern"] is False

    final_response = client.post("/v1/nostr/zap-receipts", json={"event": events[-1]})
    assert final_response.status_code == 201
    body = final_response.json()
    assert body["review"]["total_zap_msats"] == 6_000
    assert body["review"]["suspicious_zap_pattern"] is True

    with session_scope() as session:
        stored_review = session.get(Review, review_id)
        assert stored_review is not None
        expected = compute_review_helpful_score(
            review=stored_review,
            user=stored_review.user,
            total_zap_msats=6_000,
            flagged_suspicious=True,
        )
        assert stored_review.helpful_score == pytest.approx(expected)
        assert body["review"]["helpful_score"] == pytest.approx(expected)


def test_correlation_guard_allows_diverse_zaps() -> None:
    """Mixed zap sources should avoid the correlation penalty."""

    _create_schema()
    reviewer_secret = 81_234
    reviewer_pubkey = derive_xonly_public_key(reviewer_secret).hex()
    developer_secret = 91_234
    developer_pubkey = derive_xonly_public_key(developer_secret).hex()
    review_id, recipient_pubkey, _ = _seed_game_with_review(
        reviewer_pubkey=reviewer_pubkey, developer_pubkey=developer_pubkey
    )
    client = _build_client()

    base_time = int(datetime.now(tz=timezone.utc).timestamp())
    first_secret = 12_345
    second_secret = 98_765
    payloads = [
        _sign_zap_event(
            first_secret,
            review_id=review_id,
            recipient_pubkey=recipient_pubkey,
            amount_msats=2_000,
            created_at=base_time,
        ),
        _sign_zap_event(
            first_secret,
            review_id=review_id,
            recipient_pubkey=recipient_pubkey,
            amount_msats=2_000,
            created_at=base_time + 30,
        ),
        _sign_zap_event(
            second_secret,
            review_id=review_id,
            recipient_pubkey=recipient_pubkey,
            amount_msats=3_000,
            created_at=base_time + 60,
        ),
    ]

    for payload in payloads:
        response = client.post("/v1/nostr/zap-receipts", json={"event": payload})
        assert response.status_code == 201

    body = response.json()
    assert body["review"]["total_zap_msats"] == 7_000
    assert body["review"]["suspicious_zap_pattern"] is False

    with session_scope() as session:
        stored_review = session.get(Review, review_id)
        assert stored_review is not None
        expected = compute_review_helpful_score(
            review=stored_review,
            user=stored_review.user,
            total_zap_msats=7_000,
            flagged_suspicious=False,
        )
        assert stored_review.helpful_score == pytest.approx(expected)
        assert body["review"]["helpful_score"] == pytest.approx(expected)
