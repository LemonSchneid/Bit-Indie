"""Utilities for configuring application telemetry and error alerting."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from functools import lru_cache

try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
except ModuleNotFoundError:  # pragma: no cover - exercised implicitly when Sentry is absent
    class _SentrySdkStub:
        """Fallback Sentry stub used when the optional dependency is unavailable."""

        @staticmethod
        def init(*_args: object, **_kwargs: object) -> None:
            """Provide a no-op initializer matching ``sentry_sdk.init``."""

    class FastApiIntegration:  # type: ignore[no-redef]
        """Fallback FastAPI integration stub."""

        def __init__(self, *_args: object, **_kwargs: object) -> None:  # noqa: D401
            """Create a no-op stub."""

    class LoggingIntegration:  # type: ignore[no-redef]
        """Fallback logging integration stub."""

        def __init__(self, *_args: object, **_kwargs: object) -> None:  # noqa: D401
            """Create a no-op stub."""

    class SqlalchemyIntegration:  # type: ignore[no-redef]
        """Fallback SQLAlchemy integration stub."""

        def __init__(self, *_args: object, **_kwargs: object) -> None:  # noqa: D401
            """Create a no-op stub."""

    sentry_sdk = _SentrySdkStub()


DEFAULT_SENTRY_ENVIRONMENT = "development"
DEFAULT_SENTRY_TRACES_SAMPLE_RATE = 0.0
DEFAULT_SENTRY_PROFILES_SAMPLE_RATE = 0.0

_TELEMETRY_INITIALIZED = False


def _clean(value: str | None) -> str | None:
    """Return a stripped environment variable value or ``None`` when blank."""

    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _parse_sample_rate(value: str | None, *, default: float) -> float:
    """Parse sample rate inputs ensuring the result is within [0.0, 1.0]."""

    if value is None:
        return default

    try:
        parsed = float(value)
    except ValueError:
        return default

    return max(0.0, min(1.0, parsed))


@dataclass(frozen=True)
class TelemetrySettings:
    """Configuration describing telemetry providers used by the API service."""

    sentry_dsn: str | None
    environment: str
    traces_sample_rate: float
    profiles_sample_rate: float

    @classmethod
    def from_environment(cls) -> "TelemetrySettings":
        """Create telemetry settings derived from environment variables."""

        sentry_dsn = _clean(os.getenv("SENTRY_API_DSN") or os.getenv("SENTRY_DSN"))
        environment = _clean(os.getenv("SENTRY_ENVIRONMENT")) or DEFAULT_SENTRY_ENVIRONMENT
        traces_sample_rate = _parse_sample_rate(
            os.getenv("SENTRY_TRACES_SAMPLE_RATE"),
            default=DEFAULT_SENTRY_TRACES_SAMPLE_RATE,
        )
        profiles_sample_rate = _parse_sample_rate(
            os.getenv("SENTRY_PROFILES_SAMPLE_RATE"),
            default=DEFAULT_SENTRY_PROFILES_SAMPLE_RATE,
        )
        return cls(
            sentry_dsn=sentry_dsn,
            environment=environment,
            traces_sample_rate=traces_sample_rate,
            profiles_sample_rate=profiles_sample_rate,
        )


@lru_cache(maxsize=1)
def get_telemetry_settings() -> TelemetrySettings:
    """Return cached telemetry settings for reuse across the application."""

    return TelemetrySettings.from_environment()


def clear_telemetry_settings_cache() -> None:
    """Reset cached telemetry configuration. Intended for unit tests."""

    get_telemetry_settings.cache_clear()


def configure_telemetry(settings: TelemetrySettings) -> None:
    """Initialize telemetry providers such as Sentry when configured."""

    global _TELEMETRY_INITIALIZED

    if not settings.sentry_dsn:
        return

    if _TELEMETRY_INITIALIZED:
        return

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=settings.traces_sample_rate,
        profiles_sample_rate=settings.profiles_sample_rate,
        integrations=[
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        send_default_pii=False,
    )

    _TELEMETRY_INITIALIZED = True


__all__ = [
    "TelemetrySettings",
    "clear_telemetry_settings_cache",
    "configure_telemetry",
    "get_telemetry_settings",
]

