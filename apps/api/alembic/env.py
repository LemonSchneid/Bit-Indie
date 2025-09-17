"""Alembic environment configuration for the Proof of Play API."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from proof_of_play_api.core.config import get_database_settings
from proof_of_play_api.db import Base
from proof_of_play_api.db import models  # noqa: F401  # ensure models are imported for metadata discovery

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations without a live database connection."""

    settings = get_database_settings()
    context.configure(
        url=settings.url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations using an Engine connection."""

    settings = get_database_settings()
    connectable = engine_from_config(  # type: ignore[arg-type]
        {"sqlalchemy.url": settings.url},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)

        with context.begin_transaction():
            context.run_migrations()


def run_migrations() -> None:
    """Entrypoint invoked by Alembic."""

    if context.is_offline_mode():
        run_migrations_offline()
    else:
        run_migrations_online()


run_migrations()
