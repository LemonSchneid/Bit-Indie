"""Database utilities for the Proof of Play API service."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from proof_of_play_api.core.config import (
    clear_database_settings_cache,
    get_database_settings,
)


class Base(DeclarativeBase):
    """Base class for all ORM models in the service."""


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def _initialize_engine() -> Engine:
    """Create a SQLAlchemy engine using the current database settings."""

    settings = get_database_settings()
    url = make_url(settings.url)
    connect_args: dict[str, Any] = {}
    engine_kwargs: dict[str, Any] = {
        "echo": settings.echo,
        "future": True,
        "pool_pre_ping": True,
    }

    if url.get_backend_name().startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if url.database in {None, ":memory:"}:
            engine_kwargs["poolclass"] = StaticPool
            engine_kwargs.pop("pool_pre_ping", None)

    return create_engine(settings.url, connect_args=connect_args, **engine_kwargs)


def get_engine() -> Engine:
    """Return the lazily instantiated database engine."""

    global _engine
    if _engine is None:
        _engine = _initialize_engine()
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Return the global session factory, creating it on first use."""

    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), autoflush=False)
    return _session_factory


@contextmanager
def session_scope() -> Iterator[Session]:
    """Yield a managed session that commits on success and rolls back on failure."""

    session = get_session_factory()()
    try:
        yield session
        session.commit()
    finally:
        if session.in_transaction():
            session.rollback()
        session.close()


def get_session() -> Iterator[Session]:
    """FastAPI dependency that yields a managed database session."""

    with session_scope() as session:
        yield session


def reset_database_state() -> None:
    """Dispose of cached database resources and clear configuration caches."""

    global _engine
    global _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None
    clear_database_settings_cache()


__all__ = [
    "Base",
    "get_engine",
    "get_session",
    "get_session_factory",
    "reset_database_state",
    "session_scope",
]
