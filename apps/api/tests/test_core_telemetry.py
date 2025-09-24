"""Tests for telemetry configuration helpers."""

from __future__ import annotations

import types

import pytest

from bit_indie_api.core import telemetry


@pytest.fixture(autouse=True)
def reset_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure telemetry caches are reset for each test case."""

    monkeypatch.delenv("SENTRY_API_DSN", raising=False)
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    monkeypatch.delenv("SENTRY_ENVIRONMENT", raising=False)
    monkeypatch.delenv("SENTRY_TRACES_SAMPLE_RATE", raising=False)
    monkeypatch.delenv("SENTRY_PROFILES_SAMPLE_RATE", raising=False)
    telemetry.clear_telemetry_settings_cache()
    monkeypatch.setattr(telemetry, "_TELEMETRY_INITIALIZED", False)


def test_get_telemetry_settings_defaults() -> None:
    """Default settings disable Sentry and use development environment."""

    settings = telemetry.get_telemetry_settings()
    assert settings.sentry_dsn is None
    assert settings.environment == telemetry.DEFAULT_SENTRY_ENVIRONMENT
    assert settings.traces_sample_rate == pytest.approx(0.0)
    assert settings.profiles_sample_rate == pytest.approx(0.0)


def test_get_telemetry_settings_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Environment variables override defaults and are sanitized."""

    monkeypatch.setenv("SENTRY_API_DSN", " https://example.com/123 ")
    monkeypatch.setenv("SENTRY_ENVIRONMENT", "production")
    monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", "0.5")
    monkeypatch.setenv("SENTRY_PROFILES_SAMPLE_RATE", "2.0")

    settings = telemetry.get_telemetry_settings()
    assert settings.sentry_dsn == "https://example.com/123"
    assert settings.environment == "production"
    # Sample rates should be clamped between 0 and 1.
    assert settings.traces_sample_rate == pytest.approx(0.5)
    assert settings.profiles_sample_rate == pytest.approx(1.0)


def test_configure_telemetry_initializes_sentry(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sentry initialization is triggered when a DSN is configured."""

    captured = {}

    def fake_init(**kwargs: object) -> None:  # type: ignore[no-untyped-def]
        captured["kwargs"] = kwargs

    monkeypatch.setattr(telemetry.sentry_sdk, "init", fake_init)

    settings = telemetry.TelemetrySettings(
        sentry_dsn="https://ingest.example/1",
        environment="production",
        traces_sample_rate=0.25,
        profiles_sample_rate=0.75,
    )

    telemetry.configure_telemetry(settings)

    assert "kwargs" in captured
    kwargs = captured["kwargs"]
    assert kwargs["dsn"] == "https://ingest.example/1"
    assert kwargs["environment"] == "production"
    assert kwargs["traces_sample_rate"] == pytest.approx(0.25)
    assert kwargs["profiles_sample_rate"] == pytest.approx(0.75)

    integrations = kwargs["integrations"]
    assert isinstance(integrations, list)
    assert any(
        isinstance(integration, telemetry.LoggingIntegration) for integration in integrations
    )

    # Subsequent calls should be ignored without invoking the SDK again.
    captured.clear()
    telemetry.configure_telemetry(settings)
    assert captured == {}


def test_configure_telemetry_noop_without_dsn(monkeypatch: pytest.MonkeyPatch) -> None:
    """configure_telemetry returns immediately when Sentry is disabled."""

    called = types.SimpleNamespace(invoked=False)

    def fake_init(**_: object) -> None:  # type: ignore[no-untyped-def]
        called.invoked = True

    monkeypatch.setattr(telemetry.sentry_sdk, "init", fake_init)

    settings = telemetry.TelemetrySettings(
        sentry_dsn=None,
        environment="development",
        traces_sample_rate=0.0,
        profiles_sample_rate=0.0,
    )

    telemetry.configure_telemetry(settings)
    assert called.invoked is False

