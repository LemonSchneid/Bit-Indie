"""Tests for database-related configuration helpers."""

from __future__ import annotations

from proof_of_play_api.core import config


def test_database_settings_default_values(monkeypatch):
    """Default settings should map to the documented development database."""

    for key in ("DATABASE_URL", "DATABASE_ECHO", "PG_HOST", "PG_PORT", "PG_DB", "PG_USER", "PG_PASSWORD"):
        monkeypatch.delenv(key, raising=False)

    config.clear_database_settings_cache()

    settings = config.get_database_settings()
    expected_url = (
        "postgresql+psycopg://"
        f"{config.DEFAULT_DATABASE_USER}:{config.DEFAULT_DATABASE_PASSWORD}@"
        f"{config.DEFAULT_DATABASE_HOST}:{config.DEFAULT_DATABASE_PORT}/"
        f"{config.DEFAULT_DATABASE_NAME}"
    )
    assert settings.url == expected_url
    assert settings.echo is False


def test_database_settings_respects_overrides(monkeypatch):
    """Environment overrides should take priority over defaults."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("DATABASE_ECHO", "true")
    config.clear_database_settings_cache()

    settings = config.get_database_settings()
    assert settings.url == "sqlite+pysqlite:///:memory:"
    assert settings.echo is True
