"""Tests covering database engine and session helpers."""

from __future__ import annotations

import sqlalchemy as sa
import pytest

from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import User


@pytest.fixture(autouse=True)
def _reset_database(monkeypatch):
    """Ensure each test operates against a fresh in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create database tables for the in-memory engine."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def test_session_scope_commits_successful_transactions():
    """Objects added inside the session scope should persist after commit."""

    _create_schema()

    with session_scope() as session:
        session.add(User(pubkey_hex="abc123"))

    with session_scope() as session:
        count = session.scalar(sa.select(sa.func.count()).select_from(User))
        assert count == 1


def test_session_scope_rolls_back_on_error():
    """An exception inside the context should trigger a rollback."""

    _create_schema()

    with pytest.raises(RuntimeError):
        with session_scope() as session:
            session.add(User(pubkey_hex="abc123"))
            raise RuntimeError("boom")

    with session_scope() as session:
        count = session.scalar(sa.select(sa.func.count()).select_from(User))
        assert count == 0
