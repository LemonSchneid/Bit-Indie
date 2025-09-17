"""Configuration helpers for the Proof of Play API service."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Tuple


DEFAULT_STORAGE_PROVIDER = "s3"
DEFAULT_S3_PRESIGN_EXPIRATION_SECONDS = 3600
DEFAULT_S3_REGION = "us-east-1"


DEFAULT_ALLOWED_ORIGINS: Tuple[str, ...] = ("http://localhost:3000",)
DEFAULT_DATABASE_HOST = "localhost"
DEFAULT_DATABASE_PORT = 5432
DEFAULT_DATABASE_USER = "pop"
DEFAULT_DATABASE_PASSWORD = "devpass"
DEFAULT_DATABASE_NAME = "pop"


def _parse_bool(value: str | None, *, default: bool = False) -> bool:
    """Interpret common truthy string values as booleans."""

    if value is None:
        return default

    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_int(value: str | None, *, default: int) -> int:
    """Convert an environment variable to an integer, falling back to defaults."""

    if value is None:
        return default

    try:
        return int(value)
    except ValueError:
        return default


def _build_postgres_url(*, host: str, port: int, user: str, password: str, database: str) -> str:
    """Compose a SQLAlchemy-compatible PostgreSQL connection URL."""

    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{database}"


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


@dataclass(frozen=True)
class DatabaseSettings:
    """Database connection configuration."""

    url: str
    echo: bool = False

    @classmethod
    def from_environment(cls) -> "DatabaseSettings":
        """Construct database settings by reading environment variables."""

        override = os.getenv("DATABASE_URL")
        echo = _parse_bool(os.getenv("DATABASE_ECHO"))
        if override:
            return cls(url=override, echo=echo)

        host = os.getenv("PG_HOST", DEFAULT_DATABASE_HOST)
        port = _parse_int(os.getenv("PG_PORT"), default=DEFAULT_DATABASE_PORT)
        user = os.getenv("PG_USER", DEFAULT_DATABASE_USER)
        password = os.getenv("PG_PASSWORD", DEFAULT_DATABASE_PASSWORD)
        database = os.getenv("PG_DB", DEFAULT_DATABASE_NAME)
        url = _build_postgres_url(host=host, port=port, user=user, password=password, database=database)
        return cls(url=url, echo=echo)


@lru_cache(maxsize=1)
def get_database_settings() -> DatabaseSettings:
    """Return cached database settings for reuse across the application."""

    return DatabaseSettings.from_environment()


def clear_database_settings_cache() -> None:
    """Reset the cached database settings. Intended for use in tests."""

    get_database_settings.cache_clear()


class StorageConfigurationError(RuntimeError):
    """Raised when environment variables do not describe a usable storage backend."""


@dataclass(frozen=True)
class StorageSettings:
    """Configuration describing the object storage integration."""

    provider: str
    bucket: str
    region: str
    endpoint_url: str | None
    access_key: str | None
    secret_key: str | None
    presign_expiration: int
    public_base_url: str

    @classmethod
    def from_environment(cls) -> "StorageSettings":
        """Construct storage configuration by reading environment variables."""

        provider = os.getenv("STORAGE_PROVIDER", DEFAULT_STORAGE_PROVIDER).lower()
        if provider != "s3":
            msg = "Only the 's3' storage provider is currently supported."
            raise StorageConfigurationError(msg)

        bucket = os.getenv("S3_BUCKET")
        if not bucket:
            msg = "S3_BUCKET must be set when using the s3 storage provider."
            raise StorageConfigurationError(msg)

        region = os.getenv("S3_REGION", DEFAULT_S3_REGION)
        endpoint_url = os.getenv("S3_ENDPOINT")
        access_key = os.getenv("S3_ACCESS_KEY")
        secret_key = os.getenv("S3_SECRET_KEY")
        presign_expiration = _parse_int(
            os.getenv("S3_PRESIGN_EXPIRES"),
            default=DEFAULT_S3_PRESIGN_EXPIRATION_SECONDS,
        )
        public_base_url = cls._determine_public_base_url(
            bucket=bucket,
            region=region,
            endpoint_url=endpoint_url,
        )

        return cls(
            provider=provider,
            bucket=bucket,
            region=region,
            endpoint_url=endpoint_url,
            access_key=access_key,
            secret_key=secret_key,
            presign_expiration=presign_expiration,
            public_base_url=public_base_url,
        )

    @staticmethod
    def _determine_public_base_url(*, bucket: str, region: str, endpoint_url: str | None) -> str:
        """Return the base URL clients should use to retrieve stored objects."""

        explicit = os.getenv("S3_PUBLIC_BASE_URL")
        if explicit:
            return explicit.rstrip("/")

        if endpoint_url:
            return f"{endpoint_url.rstrip('/')}/{bucket}"

        normalized_region = (region or DEFAULT_S3_REGION).strip().lower()
        if normalized_region in {"", "auto", "us-east-1"}:
            host = "s3.amazonaws.com"
        else:
            host = f"s3.{normalized_region}.amazonaws.com"
        return f"https://{bucket}.{host}" if host != "s3.amazonaws.com" else f"https://{bucket}.s3.amazonaws.com"


@lru_cache(maxsize=1)
def get_storage_settings() -> StorageSettings:
    """Return cached storage configuration settings."""

    return StorageSettings.from_environment()


def clear_storage_settings_cache() -> None:
    """Reset the cached storage settings. Intended for use in tests."""

    get_storage_settings.cache_clear()
