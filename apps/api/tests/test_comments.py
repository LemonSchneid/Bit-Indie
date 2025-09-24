from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from bit_indie_api.api.v1.routes.comments import (
    get_comment_thread_service,
    get_comment_workflow,
    get_raw_comment_body,
)
from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import (
    Comment,
    Developer,
    Game,
    GameStatus,
    InvoiceStatus,
    Purchase,
    ReleaseNoteReply,
    User,
)
from bit_indie_api.main import create_application
from bit_indie_api.services.comment_thread import (
    CommentAuthorDTO,
    CommentDTO,
    CommentSource,
    encode_npub,
)
from bit_indie_api.schemas.comment import CommentCreateRequest
from sqlalchemy.orm import Session
from bit_indie_api.services.proof_of_work import (
    PROOF_OF_WORK_DIFFICULTY_BITS,
    calculate_proof_of_work_hash,
    count_leading_zero_bits,
)
from bit_indie_api.services.rate_limiting import COMMENT_RATE_LIMIT_MAX_ITEMS


NOSTR_ENABLED = os.getenv("NOSTR_ENABLED", "false").lower() == "true"

pytestmark = pytest.mark.skipif(
    not NOSTR_ENABLED,
    reason="Nostr features are disabled for the Simple MVP",
)


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Ensure each test runs against isolated database state."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    get_comment_thread_service().clear_cache()
    yield
    reset_database_state()
    get_comment_thread_service().clear_cache()


def _create_schema() -> None:
    """Create ORM tables for the in-memory SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    """Return a FastAPI client bound to a fresh application instance."""

    return TestClient(create_application())


def _build_raw_request(body: bytes) -> Request:
    """Return a Starlette request object carrying the provided raw body."""

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/",
        "headers": [(b"content-type", b"application/json")],
        "query_string": b"",
        "client": ("testclient", 5000),
        "server": ("testserver", 80),
    }
    state = {"body": body, "sent": False}

    async def receive() -> dict[str, object]:
        if state["sent"]:
            return {"type": "http.request", "body": b"", "more_body": False}
        state["sent"] = True
        return {"type": "http.request", "body": state["body"], "more_body": False}

    return Request(scope, receive)


def _seed_game(*, active: bool = True) -> str:
    """Persist a developer-owned game and return its identifier."""

    with session_scope() as session:
        developer_user = User(pubkey_hex=f"dev-{uuid.uuid4().hex}")
        session.add(developer_user)
        session.flush()

        developer = Developer(user_id=developer_user.id)
        session.add(developer)
        session.flush()

        game = Game(
            developer_id=developer.id,
            title="Nebula Drift",
            slug=f"nebula-drift-{uuid.uuid4().hex[:8]}",
            status=GameStatus.UNLISTED,
            active=active,
        )
        session.add(game)
        session.flush()
        game_id = game.id

    return game_id


def _create_user(*, reputation_score: int = 0, pubkey_hex: str | None = None) -> str:
    """Persist a standalone user and return its identifier."""

    with session_scope() as session:
        user = User(pubkey_hex=pubkey_hex or f"user-{uuid.uuid4().hex}", reputation_score=reputation_score)
        session.add(user)
        session.flush()
        user_id = user.id

    return user_id


def _get_user_pubkey(user_id: str) -> str:
    """Return the hex-encoded pubkey for the referenced user."""

    with session_scope() as session:
        user = session.get(User, user_id)
        assert user is not None
        return user.pubkey_hex


def _mine_proof_of_work(*, user_id: str, resource_id: str, body_md: str) -> dict[str, int]:
    """Return proof-of-work data satisfying the configured difficulty."""

    nonce = 0
    while True:
        digest = calculate_proof_of_work_hash(
            user_id=user_id,
            resource_id=resource_id,
            payload=body_md,
            nonce=nonce,
        )
        if count_leading_zero_bits(digest) >= PROOF_OF_WORK_DIFFICULTY_BITS:
            return {"nonce": nonce}
        nonce += 1


def test_create_comment_persists_and_returns_payload() -> None:
    """Posting a comment should persist the record and return the stored payload."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user(reputation_score=25)
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={"user_id": user_id, "body_md": "  Excited to play this build!  "},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["game_id"] == game_id
    assert body["body_md"] == "Excited to play this build!"
    assert body["source"] == "FIRST_PARTY"
    assert body["author"]["user_id"] == user_id
    assert body["author"]["lightning_address"] is None
    assert body["is_verified_purchase"] is False
    assert body["total_zap_msats"] == 0

    with session_scope() as session:
        stored = session.get(Comment, body["id"])
        assert stored is not None
        assert stored.body_md == "Excited to play this build!"


def test_create_comment_requires_known_user() -> None:
    """Submitting a comment with an unknown user should return a 404 error."""

    _create_schema()
    game_id = _seed_game(active=True)
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={"user_id": "missing", "body_md": "Hello"},
    )

    assert response.status_code == 404


def test_create_comment_rejects_inactive_game() -> None:
    """Attempting to comment on an inactive game should return a 404 response."""

    _create_schema()
    game_id = _seed_game(active=False)
    user_id = _create_user(reputation_score=25)
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={"user_id": user_id, "body_md": "Looks awesome"},
    )

    assert response.status_code == 404


def test_create_comment_requires_proof_of_work_for_low_reputation() -> None:
    """Low reputation users must provide proof of work when posting a comment."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()
    client = _build_client()

    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={"user_id": user_id, "body_md": "Need access"},
    )

    assert response.status_code == 400
    assert "proof of work" in response.json()["detail"].lower()


def test_create_comment_accepts_valid_proof_of_work() -> None:
    """Supplying valid proof of work should allow a low reputation comment to post."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()
    client = _build_client()
    body_md = "First impressions"
    proof = _mine_proof_of_work(
        user_id=user_id,
        resource_id=f"comment:{game_id}",
        body_md=body_md,
    )

    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={
            "user_id": user_id,
            "body_md": body_md,
            "proof_of_work": proof,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["body_md"] == body_md


def test_create_comment_respects_workflow_dependency_override() -> None:
    """API handlers should honor dependency overrides for the comment workflow."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user(reputation_score=50)
    client = _build_client()

    captured: dict[str, object] = {}

    class StubWorkflow:
        """Capture workflow invocations for dependency override verification."""

        def create_comment(
            self,
            *,
            session: Session,
            game_id: str,
            request: CommentCreateRequest,
            raw_body_md: str | None,
        ) -> CommentDTO:
            captured["session"] = session
            captured["game_id"] = game_id
            captured["user_id"] = request.user_id
            captured["raw_body_md"] = raw_body_md
            captured["normalized_body_md"] = request.body_md
            author = CommentAuthorDTO(
                user_id=request.user_id,
                pubkey_hex=None,
                npub=None,
                display_name=None,
                lightning_address=None,
            )
            return CommentDTO(
                id="stub-comment",
                game_id=game_id,
                body_md=request.body_md,
                created_at=datetime.now(timezone.utc),
                source=CommentSource.FIRST_PARTY,
                author=author,
                is_verified_purchase=False,
                total_zap_msats=0,
            )

    overrides = client.app.dependency_overrides
    overrides[get_comment_workflow] = lambda: StubWorkflow()

    try:
        response = client.post(
            f"/v1/games/{game_id}/comments",
            json={"user_id": user_id, "body_md": "  Spaced content  "},
        )
    finally:
        overrides.pop(get_comment_workflow, None)

    assert response.status_code == 201
    assert captured["game_id"] == game_id
    assert captured["user_id"] == user_id
    assert isinstance(captured["session"], Session)
    assert captured["normalized_body_md"] == "Spaced content"
    assert captured["raw_body_md"] == "  Spaced content  "
    assert response.json()["id"] == "stub-comment"


def test_create_comment_enforces_rate_limit() -> None:
    """Users exceeding the rate limit should receive a 429 response."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user(reputation_score=50)
    now = datetime.now(timezone.utc)

    with session_scope() as session:
        for index in range(COMMENT_RATE_LIMIT_MAX_ITEMS):
            session.add(
                Comment(
                    game_id=game_id,
                    user_id=user_id,
                    body_md=f"seed-{index}",
                    created_at=now - timedelta(seconds=index + 1),
                )
            )

    client = _build_client()
    response = client.post(
        f"/v1/games/{game_id}/comments",
        json={"user_id": user_id, "body_md": "One more thought"},
    )

    assert response.status_code == 429
    assert "rate limit" in response.json()["detail"].lower()
    assert "Retry-After" in response.headers


def test_get_raw_comment_body_returns_original_payload() -> None:
    """Raw-body dependency should return the untrimmed markdown string when present."""

    request = _build_raw_request(b'{"body_md": "  Raw content  "}')
    result = asyncio.run(get_raw_comment_body(request))

    assert result == "  Raw content  "


def test_get_raw_comment_body_returns_none_for_invalid_payload() -> None:
    """Malformed JSON payloads should yield a null raw markdown body."""

    request = _build_raw_request(b"{\"body_md\": \"missing brace\"")
    result = asyncio.run(get_raw_comment_body(request))

    assert result is None


def test_list_comments_returns_chronological_order() -> None:
    """Listing comments should return them sorted by creation timestamp."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()

    first_created = datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc)
    second_created = datetime(2024, 1, 2, 9, 30, tzinfo=timezone.utc)

    with session_scope() as session:
        first = Comment(game_id=game_id, user_id=user_id, body_md="First!", created_at=first_created)
        second = Comment(game_id=game_id, user_id=user_id, body_md="Can't wait", created_at=second_created)
        session.add_all([first, second])

    client = _build_client()
    response = client.get(f"/v1/games/{game_id}/comments")

    assert response.status_code == 200
    body = response.json()
    assert [item["body_md"] for item in body] == ["First!", "Can't wait"]
    assert body[0]["created_at"] < body[1]["created_at"]


def test_list_comments_excludes_hidden_entries() -> None:
    """Hidden comments should not appear in the public listing."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()

    with session_scope() as session:
        visible = Comment(game_id=game_id, user_id=user_id, body_md="Visible note")
        hidden = Comment(
            game_id=game_id,
            user_id=user_id,
            body_md="Hidden note",
            is_hidden=True,
        )
        session.add_all([visible, hidden])

    client = _build_client()
    response = client.get(f"/v1/games/{game_id}/comments")

    assert response.status_code == 200
    body = response.json()
    assert [item["body_md"] for item in body] == ["Visible note"]


def test_list_comments_merges_release_note_replies() -> None:
    """Release note replies should appear alongside first-party comments."""

    _create_schema()
    game_id = _seed_game(active=True)
    user_id = _create_user()
    comment_created = datetime(2024, 1, 5, 9, 0, tzinfo=timezone.utc)
    reply_created = datetime(2024, 1, 5, 10, 30, tzinfo=timezone.utc)
    release_event_id = f"event-{uuid.uuid4().hex}"
    relay_pubkey = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"

    with session_scope() as session:
        session.add(
            Comment(
                game_id=game_id,
                user_id=user_id,
                body_md="Original note",
                created_at=comment_created,
            )
        )
        session.add(
            ReleaseNoteReply(
                game_id=game_id,
                release_note_event_id=release_event_id,
                relay_url="https://relay.one/replies",
                event_id=f"reply-{uuid.uuid4().hex}",
                pubkey=relay_pubkey,
                kind=1,
                event_created_at=reply_created,
                content="Congrats on the launch!",
                tags_json=json.dumps([["e", release_event_id]]),
            )
        )

    client = _build_client()
    response = client.get(f"/v1/games/{game_id}/comments")

    assert response.status_code == 200
    body = response.json()
    assert [entry["source"] for entry in body] == ["FIRST_PARTY", "NOSTR"]
    assert body[1]["body_md"] == "Congrats on the launch!"
    assert body[1]["author"]["npub"].startswith("npub1")


def test_release_note_reply_marks_verified_purchase_when_pubkey_matches() -> None:
    """Replies authored by a purchaser should be marked as verified."""

    _create_schema()
    game_id = _seed_game(active=True)
    purchaser_hex = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"
    user_id = _create_user(pubkey_hex=purchaser_hex)
    release_event_id = f"event-{uuid.uuid4().hex}"

    with session_scope() as session:
        session.add(
            Purchase(
                user_id=user_id,
                game_id=game_id,
                invoice_id=f"invoice-{uuid.uuid4().hex}",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=1000,
                paid_at=datetime.now(timezone.utc),
            )
        )
        session.add(
            ReleaseNoteReply(
                game_id=game_id,
                release_note_event_id=release_event_id,
                relay_url="https://relay.author/replies",
                event_id=f"reply-{uuid.uuid4().hex}",
                pubkey=purchaser_hex,
                kind=1,
                event_created_at=datetime(2024, 1, 6, 14, 0, tzinfo=timezone.utc),
                content="Purchased and loved it!",
                tags_json=json.dumps([["e", release_event_id]]),
            )
        )

    client = _build_client()
    response = client.get(f"/v1/games/{game_id}/comments")

    assert response.status_code == 200
    comments = response.json()
    assert len(comments) == 1
    entry = comments[0]
    assert entry["source"] == "NOSTR"
    assert entry["is_verified_purchase"] is True
    assert entry["author"]["user_id"] == user_id


def test_release_note_reply_participant_tags_do_not_affect_author_resolution() -> None:
    """Generic participant tags must not attribute replies to other users."""

    _create_schema()
    game_id = _seed_game(active=True)
    purchaser_hex = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"
    user_id = _create_user(pubkey_hex=purchaser_hex)
    release_event_id = f"event-{uuid.uuid4().hex}"
    relay_pubkey = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"

    with session_scope() as session:
        session.add(
            Purchase(
                user_id=user_id,
                game_id=game_id,
                invoice_id=f"invoice-{uuid.uuid4().hex}",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=1000,
                paid_at=datetime.now(timezone.utc),
            )
        )
        session.add(
            ReleaseNoteReply(
                game_id=game_id,
                release_note_event_id=release_event_id,
                relay_url="https://relay.alias/replies",
                event_id=f"reply-{uuid.uuid4().hex}",
                pubkey=relay_pubkey,
                kind=1,
                event_created_at=datetime(2024, 1, 6, 15, 0, tzinfo=timezone.utc),
                content="Congrats on the launch!",
                tags_json=json.dumps([["e", release_event_id], ["p", purchaser_hex]]),
            )
        )

    client = _build_client()
    response = client.get(f"/v1/games/{game_id}/comments")

    assert response.status_code == 200
    comments = response.json()
    assert len(comments) == 1
    entry = comments[0]
    assert entry["source"] == "NOSTR"
    assert entry["author"]["user_id"] is None
    assert entry["is_verified_purchase"] is False
    assert entry["author"]["pubkey_hex"] == relay_pubkey.lower()


def test_release_note_reply_ignores_alias_pubkeys_that_do_not_match_sender() -> None:
    """Alias tags referencing other users should not influence verification."""

    _create_schema()
    game_id = _seed_game(active=True)
    purchaser_hex = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"
    user_id = _create_user(pubkey_hex=purchaser_hex)
    alias_npub = encode_npub(purchaser_hex)
    assert alias_npub is not None
    release_event_id = f"event-{uuid.uuid4().hex}"
    relay_pubkey = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"

    with session_scope() as session:
        session.add(
            Purchase(
                user_id=user_id,
                game_id=game_id,
                invoice_id=f"invoice-{uuid.uuid4().hex}",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=750,
                paid_at=datetime.now(timezone.utc),
            )
        )
        session.add(
            ReleaseNoteReply(
                game_id=game_id,
                release_note_event_id=release_event_id,
                relay_url="https://relay.alias/replies",
                event_id=f"reply-{uuid.uuid4().hex}",
                pubkey=relay_pubkey,
                kind=1,
                event_created_at=datetime(2024, 1, 6, 16, 0, tzinfo=timezone.utc),
                content="Zap sent!",
                tags_json=json.dumps([["e", release_event_id], ["alias", alias_npub]]),
            )
        )

    client = _build_client()
    response = client.get(f"/v1/games/{game_id}/comments")

    assert response.status_code == 200
    comments = response.json()
    assert len(comments) == 1
    entry = comments[0]
    assert entry["source"] == "NOSTR"
    assert entry["author"]["user_id"] is None
    assert entry["is_verified_purchase"] is False


def test_release_note_reply_ignores_aliases_when_sender_pubkey_invalid() -> None:
    """Alias tags should be ignored when the reply's pubkey cannot be validated."""

    _create_schema()
    game_id = _seed_game(active=True)
    purchaser_hex = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"
    user_id = _create_user(pubkey_hex=purchaser_hex)
    alias_npub = encode_npub(purchaser_hex)
    assert alias_npub is not None
    release_event_id = f"event-{uuid.uuid4().hex}"
    invalid_pubkey = "not-a-valid-pubkey"

    with session_scope() as session:
        session.add(
            Purchase(
                user_id=user_id,
                game_id=game_id,
                invoice_id=f"invoice-{uuid.uuid4().hex}",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=1500,
                paid_at=datetime.now(timezone.utc),
            )
        )
        session.add(
            ReleaseNoteReply(
                game_id=game_id,
                release_note_event_id=release_event_id,
                relay_url="https://relay.alias/replies",
                event_id=f"reply-{uuid.uuid4().hex}",
                pubkey=invalid_pubkey,
                kind=1,
                event_created_at=datetime(2024, 1, 6, 17, 0, tzinfo=timezone.utc),
                content="Excited to try this out!",
                tags_json=json.dumps([["e", release_event_id], ["alias", alias_npub]]),
            )
        )

    client = _build_client()
    response = client.get(f"/v1/games/{game_id}/comments")

    assert response.status_code == 200
    comments = response.json()
    assert len(comments) == 1
    entry = comments[0]
    assert entry["source"] == "NOSTR"
    assert entry["author"]["user_id"] is None
    assert entry["author"]["pubkey_hex"] is None
    assert entry["is_verified_purchase"] is False


def test_hidden_release_note_replies_are_not_listed() -> None:
    """Replies marked as hidden should be excluded from storefront responses."""

    _create_schema()
    game_id = _seed_game(active=True)
    release_event_id = f"event-{uuid.uuid4().hex}"

    with session_scope() as session:
        session.add(
            ReleaseNoteReply(
                game_id=game_id,
                release_note_event_id=release_event_id,
                relay_url="https://relay.hidden/replies",
                event_id=f"reply-{uuid.uuid4().hex}",
                pubkey=f"{uuid.uuid4().hex}{uuid.uuid4().hex}",
                kind=1,
                event_created_at=datetime(2024, 1, 7, 12, 0, tzinfo=timezone.utc),
                content="Hidden reply",
                tags_json=json.dumps([["e", release_event_id]]),
                is_hidden=True,
                moderation_notes="Hidden during audit.",
            )
        )

    client = _build_client()
    response = client.get(f"/v1/games/{game_id}/comments")

    assert response.status_code == 200
    assert response.json() == []
