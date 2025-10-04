from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import User
from bit_indie_api.main import create_application


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Ensure each test runs against isolated database state."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    return TestClient(create_application())


def _create_user(*, is_admin: bool = False, display_name: str | None = None) -> str:
    with session_scope() as session:
        user = User(
            account_identifier=f"user-{uuid.uuid4().hex}",
            is_admin=is_admin,
            display_name=display_name,
        )
        session.add(user)
        session.flush()
        return user.id


def test_create_thread_and_list() -> None:
    _create_schema()
    client = _build_client()
    user_id = _create_user(display_name="Orbit Foundry")

    response = client.post(
        "/v1/community/threads",
        json={
            "user_id": user_id,
            "title": " Dev Update ",
            "body_md": "  First build is live!  ",
            "tags": ["Dev Log", "Lightning"],
        },
    )

    assert response.status_code == 201
    body = response.json()
    thread_id = body["id"]
    assert body["title"] == "Dev Update"
    assert body["body_md"] == "First build is live!"
    assert body["tags"] == ["dev-log", "lightning"]
    assert body["reply_count"] == 0

    list_response = client.get("/v1/community/threads")
    assert list_response.status_code == 200
    threads = list_response.json()
    assert len(threads) == 1
    assert threads[0]["id"] == thread_id
    assert threads[0]["reply_count"] == 0
    assert threads[0]["tags"] == ["dev-log", "lightning"]

    filtered = client.get("/v1/community/threads", params={"tag": "dev-log"})
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1

    filtered_empty = client.get("/v1/community/threads", params={"tag": "wishlist"})
    assert filtered_empty.status_code == 200
    assert filtered_empty.json() == []


def test_create_post_and_replies_flow() -> None:
    _create_schema()
    client = _build_client()
    author_id = _create_user(display_name="Orbit")
    responder_id = _create_user(display_name="Nova")

    thread = client.post(
        "/v1/community/threads",
        json={"user_id": author_id, "body_md": "Let us know what you think!", "tags": []},
    )
    thread_id = thread.json()["id"]

    post_response = client.post(
        f"/v1/community/threads/{thread_id}/posts",
        json={"user_id": author_id, "body_md": "Does the installer work for you?"},
    )
    assert post_response.status_code == 201
    top_post = post_response.json()

    reply_response = client.post(
        f"/v1/community/threads/{thread_id}/posts",
        json={
            "user_id": responder_id,
            "body_md": "Worked great on macOS.",
            "parent_post_id": top_post["id"],
        },
    )
    assert reply_response.status_code == 201

    detail = client.get(f"/v1/community/threads/{thread_id}")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["reply_count"] == 2
    assert len(detail_body["posts"]) == 1
    first_post = detail_body["posts"][0]
    assert first_post["reply_count"] == 1

    replies = client.get(f"/v1/community/posts/{top_post['id']}/replies")
    assert replies.status_code == 200
    reply_items = replies.json()
    assert len(reply_items) == 1
    assert reply_items[0]["body_md"] == "Worked great on macOS."


def test_remove_post_requires_admin() -> None:
    _create_schema()
    client = _build_client()
    author_id = _create_user()
    participant_id = _create_user()
    admin_id = _create_user(is_admin=True)

    thread_id = client.post(
        "/v1/community/threads",
        json={"user_id": author_id, "body_md": "Share feedback here."},
    ).json()["id"]

    post_id = client.post(
        f"/v1/community/threads/{thread_id}/posts",
        json={"user_id": participant_id, "body_md": "Love the vibe."},
    ).json()["id"]

    forbidden = client.delete(
        f"/v1/community/posts/{post_id}",
        json={"admin_id": participant_id},
    )
    assert forbidden.status_code == 403

    removal = client.delete(
        f"/v1/community/posts/{post_id}",
        json={"admin_id": admin_id},
    )
    assert removal.status_code == 200
    removal_body = removal.json()
    assert removal_body["is_removed"] is True
    assert removal_body["body_md"] is None

    detail = client.get(f"/v1/community/threads/{thread_id}")
    posts = detail.json()["posts"]
    assert posts[0]["is_removed"] is True


def test_thread_requires_content() -> None:
    _create_schema()
    client = _build_client()
    user_id = _create_user()

    response = client.post(
        "/v1/community/threads",
        json={"user_id": user_id, "title": "  ", "body_md": "\n"},
    )

    assert response.status_code == 400


def test_post_requires_body() -> None:
    _create_schema()
    client = _build_client()
    author_id = _create_user()

    thread_id = client.post(
        "/v1/community/threads",
        json={"user_id": author_id, "body_md": "Initial message."},
    ).json()["id"]

    response = client.post(
        f"/v1/community/threads/{thread_id}/posts",
        json={"user_id": author_id, "body_md": "  "},
    )

    assert response.status_code == 400

