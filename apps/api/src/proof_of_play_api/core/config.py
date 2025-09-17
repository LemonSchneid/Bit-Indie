"""Configuration helpers for the Proof of Play API service."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Tuple


DEFAULT_ALLOWED_ORIGINS: Tuple[str, ...] = ("http://localhost:3000",)


@dataclass(frozen=True)
class ApiSettings:
    """Runtime configuration for the FastAPI application."""

    title: str = "Proof of Play API"
    version: str = "0.1.0"
    allowed_origins: Tuple[str, ...] = DEFAULT_ALLOWED_ORIGINS

    @classmethod
    def from_environment(cls) -> "ApiSettings":
        """Build settings by reading environment variables."""

        origins = cls._parse_origins(os.getenv("API_ORIGINS"))
        return cls(allowed_origins=origins)

    @staticmethod
    def _parse_origins(raw_origins: str | None) -> Tuple[str, ...]:
        """Normalize a comma separated list of origins."""

        if not raw_origins:
            return DEFAULT_ALLOWED_ORIGINS

        parsed = tuple(origin.strip() for origin in raw_origins.split(",") if origin.strip())
        return parsed or DEFAULT_ALLOWED_ORIGINS


@lru_cache(maxsize=1)
def get_settings() -> ApiSettings:
    """Return a cached `ApiSettings` instance."""

    return ApiSettings.from_environment()


def clear_settings_cache() -> None:
    """Reset the cached settings. Intended for use in tests."""

    get_settings.cache_clear()
