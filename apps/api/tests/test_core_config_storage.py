"""Tests for storage-related configuration helpers."""

from __future__ import annotations

import pytest

from bit_indie_api.core.config import (
    StorageConfigurationError,
    StorageSettings,
    clear_storage_settings_cache,
    get_storage_settings,
)


@pytest.fixture(autouse=True)
def _reset_storage_settings():
    """Ensure storage settings cache is cleared between tests."""

    clear_storage_settings_cache()
    yield
    clear_storage_settings_cache()


def test_storage_settings_from_environment_uses_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    """Providing an endpoint should build a public URL anchored to the bucket."""

    monkeypatch.setenv("STORAGE_PROVIDER", "s3")
    monkeypatch.setenv("S3_BUCKET", "pop-games")
    monkeypatch.setenv("S3_ENDPOINT", "http://localhost:9000")
    monkeypatch.delenv("S3_PUBLIC_BASE_URL", raising=False)

    settings = get_storage_settings()

    assert settings.bucket == "pop-games"
    assert settings.public_base_url == "http://localhost:9000/pop-games"


def test_storage_settings_requires_bucket(monkeypatch: pytest.MonkeyPatch) -> None:
    """Missing the bucket environment variable should raise an explicit error."""

    monkeypatch.setenv("STORAGE_PROVIDER", "s3")
    monkeypatch.delenv("S3_BUCKET", raising=False)

    with pytest.raises(StorageConfigurationError):
        StorageSettings.from_environment()
