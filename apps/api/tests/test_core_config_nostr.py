"""Tests covering the Nostr publisher configuration helpers."""

from __future__ import annotations

from pathlib import Path

import pytest

from proof_of_play_api.core.config import (
    NostrPublisherConfigurationError,
    clear_nostr_ingestor_settings_cache,
    clear_nostr_publisher_settings_cache,
    get_nostr_ingestor_settings,
    get_nostr_publisher_settings,
)
from proof_of_play_api.services.nostr import SECP256K1_N


@pytest.fixture(autouse=True)
def _reset_cache() -> None:
    """Ensure configuration caches are reset between tests."""

    clear_nostr_publisher_settings_cache()
    clear_nostr_ingestor_settings_cache()
    yield
    clear_nostr_publisher_settings_cache()
    clear_nostr_ingestor_settings_cache()


def test_get_nostr_publisher_settings_loads_from_environment(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings should parse relay lists, keys, and optional values."""

    signing_key = 123456789
    key_hex = f"{signing_key:064x}"
    key_file = tmp_path / "platform.key"
    key_file.write_text(key_hex, encoding="utf-8")

    monkeypatch.setenv("NOSTR_RELAYS", "wss://relay.one,wss://relay.two")
    monkeypatch.setenv("PLATFORM_PUBKEY", "a" * 64)
    monkeypatch.setenv("PLATFORM_SIGNING_KEY_PATH", str(key_file))
    monkeypatch.setenv("PLATFORM_LNURL", "lnurl1example")
    monkeypatch.setenv("PUBLIC_WEB_URL", "https://games.example.com/")
    monkeypatch.setenv("NOSTR_PUBLISHER_BACKOFF_SECONDS", "30")
    monkeypatch.setenv("NOSTR_PUBLISHER_BACKOFF_CAP_SECONDS", "300")
    monkeypatch.setenv("NOSTR_PUBLISHER_CIRCUIT_BREAKER_ATTEMPTS", "4")
    monkeypatch.setenv("NOSTR_PUBLISHER_TIMEOUT", "5.5")

    settings = get_nostr_publisher_settings()

    assert settings.relays == ("wss://relay.one", "wss://relay.two")
    assert settings.platform_pubkey == "a" * 64
    assert settings.private_key == int(key_hex, 16)
    assert settings.platform_lnurl == "lnurl1example"
    assert settings.public_web_url == "https://games.example.com"
    assert settings.backoff_seconds == 30
    assert settings.backoff_cap_seconds == 300
    assert settings.circuit_breaker_attempts == 4
    assert settings.request_timeout == 5.5


def test_get_nostr_publisher_settings_requires_relays(monkeypatch: pytest.MonkeyPatch) -> None:
    """Missing relay configuration should raise an explicit error."""

    monkeypatch.delenv("NOSTR_RELAYS", raising=False)
    monkeypatch.setenv("PLATFORM_PUBKEY", "b" * 64)
    monkeypatch.setenv("PLATFORM_SIGNING_KEY_HEX", "c" * 64)

    with pytest.raises(NostrPublisherConfigurationError):
        get_nostr_publisher_settings()


def test_get_nostr_publisher_settings_rejects_invalid_private_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keys outside the secp256k1 range should be rejected."""

    monkeypatch.setenv("NOSTR_RELAYS", "wss://relay.test")
    monkeypatch.setenv("PLATFORM_PUBKEY", "d" * 64)
    bad_key = f"{SECP256K1_N:064x}"
    monkeypatch.setenv("PLATFORM_SIGNING_KEY_HEX", bad_key)

    with pytest.raises(NostrPublisherConfigurationError):
        get_nostr_publisher_settings()


def test_get_nostr_ingestor_settings_loads_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ingestor settings should parse relay list and numeric overrides."""

    monkeypatch.setenv("NOSTR_RELAYS", "wss://relay.one,wss://relay.two")
    monkeypatch.setenv("NOSTR_INGESTION_TIMEOUT", "4.5")
    monkeypatch.setenv("NOSTR_INGESTION_BATCH_LIMIT", "125")
    monkeypatch.setenv("NOSTR_INGESTION_LOOKBACK_SECONDS", "7200")

    settings = get_nostr_ingestor_settings()

    assert settings.relays == ("wss://relay.one", "wss://relay.two")
    assert settings.request_timeout == 4.5
    assert settings.batch_limit == 125
    assert settings.lookback_seconds == 7200


def test_get_nostr_ingestor_settings_requires_relays(monkeypatch: pytest.MonkeyPatch) -> None:
    """Relays remain a required configuration for the ingestion pipeline."""

    monkeypatch.delenv("NOSTR_RELAYS", raising=False)

    with pytest.raises(NostrPublisherConfigurationError):
        get_nostr_ingestor_settings()
