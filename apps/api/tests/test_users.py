import os

from fastapi.testclient import TestClient

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import User
from proof_of_play_api.main import create_application


def _create_schema() -> None:
    engine = get_engine()
    Base.metadata.create_all(engine)


def _build_client() -> TestClient:
    app = create_application()
    return TestClient(app)


def test_update_lightning_address() -> None:
    """Users should be able to update their Lightning payout address."""

    reset_database_state()
    os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
    _create_schema()

    with session_scope() as session:
        user = User(pubkey_hex="user-update")
        session.add(user)
        session.flush()
        user_id = user.id

    client = _build_client()
    response = client.patch(
        f"/v1/users/{user_id}/lightning-address",
        json={"lightning_address": "creator@ln.example.com"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["lightning_address"] == "creator@ln.example.com"

    with session_scope() as session:
        stored = session.get(User, user_id)
        assert stored is not None
        assert stored.lightning_address == "creator@ln.example.com"

    reset_database_state()
