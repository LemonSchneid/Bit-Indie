import os

from fastapi.testclient import TestClient

from bit_indie_api.core.config import clear_settings_cache, get_settings
from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import User
from bit_indie_api.main import create_application
from bit_indie_api.services.session_tokens import create_session_token


def _create_schema() -> None:
    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    app = create_application()
    return TestClient(app)


def _prepare_environment() -> None:
    """Ensure the database and settings are initialized for a test run."""

    reset_database_state()
    os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
    os.environ["API_SESSION_SECRET"] = "test-session-secret"
    clear_settings_cache()
    _create_schema()


def _cleanup_environment() -> None:
    """Reset global state after a test completes."""

    reset_database_state()
    os.environ.pop("DATABASE_URL", None)
    os.environ.pop("API_SESSION_SECRET", None)
    clear_settings_cache()


def _issue_token(user_id: str) -> str:
    """Return a signed session token for the provided user."""

    settings = get_settings()
    return create_session_token(
        user_id=user_id,
        secret=settings.session_secret,
        ttl_seconds=settings.session_ttl_seconds,
    )


def test_update_lightning_address() -> None:
    """Users should be able to update their Lightning payout address."""

    _prepare_environment()

    try:
        with session_scope() as session:
            user = User(pubkey_hex="user-update")
            session.add(user)
            session.flush()
            user_id = user.id

        client = _build_client()
        token = _issue_token(user_id)
        response = client.patch(
            f"/v1/users/{user_id}/lightning-address",
            json={"lightning_address": "creator@ln.example.com"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["lightning_address"] == "creator@ln.example.com"

        with session_scope() as session:
            stored = session.get(User, user_id)
            assert stored is not None
            assert stored.lightning_address == "creator@ln.example.com"
    finally:
        _cleanup_environment()


def test_update_lightning_address_requires_authentication() -> None:
    """Requests without an authentication token should be rejected."""

    _prepare_environment()

    try:
        with session_scope() as session:
            user = User(pubkey_hex="user-no-auth")
            session.add(user)
            session.flush()
            user_id = user.id

        client = _build_client()
        response = client.patch(
            f"/v1/users/{user_id}/lightning-address",
            json={"lightning_address": "creator@ln.example.com"},
        )

        assert response.status_code == 401
    finally:
        _cleanup_environment()


def test_update_lightning_address_rejects_mismatched_user() -> None:
    """Users cannot update payout details for other accounts."""

    _prepare_environment()

    try:
        with session_scope() as session:
            owner = User(pubkey_hex="owner-user")
            attacker = User(pubkey_hex="attacker-user")
            session.add_all([owner, attacker])
            session.flush()
            owner_id = owner.id
            attacker_id = attacker.id

        client = _build_client()
        token = _issue_token(attacker_id)
        response = client.patch(
            f"/v1/users/{owner_id}/lightning-address",
            json={"lightning_address": "malicious@ln.example.com"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403
    finally:
        _cleanup_environment()
