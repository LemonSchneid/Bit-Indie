"""Configuration helpers for the Proof of Play API service."""

from __future__ import annotations

import os

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Tuple

from proof_of_play_api.services.nostr import SECP256K1_N


DEFAULT_STORAGE_PROVIDER = "s3"
DEFAULT_S3_PRESIGN_EXPIRATION_SECONDS = 3600
DEFAULT_S3_REGION = "us-east-1"
DEFAULT_PAYMENT_PROVIDER = "lnbits"
DEFAULT_PUBLIC_WEB_URL = "http://localhost:3000"
DEFAULT_NOSTR_REQUEST_TIMEOUT_SECONDS = 10.0
DEFAULT_NOSTR_BACKOFF_SECONDS = 60
DEFAULT_NOSTR_BACKOFF_CAP_SECONDS = 3600
DEFAULT_NOSTR_CIRCUIT_BREAKER_ATTEMPTS = 5
DEFAULT_NOSTR_INGESTION_TIMEOUT_SECONDS = 10.0
DEFAULT_NOSTR_INGESTION_BATCH_LIMIT = 200
DEFAULT_NOSTR_INGESTION_LOOKBACK_SECONDS = 86_400


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


def _parse_float(value: str | None, *, default: float) -> float:
    """Convert an environment variable to a float, returning the default on errors."""

    if value is None:
        return default

    try:
        return float(value)
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


class PaymentsConfigurationError(RuntimeError):
    """Raised when payment related environment variables are invalid or missing."""


@dataclass(frozen=True)
class LnBitsSettings:
    """Configuration describing how to talk to an LNbits wallet."""

    api_url: str
    api_key: str
    wallet_id: str


@dataclass(frozen=True)
class PaymentSettings:
    """High level payment provider configuration for the application."""

    provider: str
    lnbits: LnBitsSettings


def _normalize_base_url(url: str) -> str:
    """Ensure provider base URLs do not end with a trailing slash."""

    return url.rstrip("/")


@lru_cache(maxsize=1)
def get_payment_settings() -> PaymentSettings:
    """Return cached payment provider settings derived from the environment."""

    provider = os.getenv("LN_PROVIDER", DEFAULT_PAYMENT_PROVIDER).strip().lower()
    if provider != "lnbits":
        msg = "Only the 'lnbits' Lightning provider is currently supported."
        raise PaymentsConfigurationError(msg)

    api_url = os.getenv("LNBITS_API_URL")
    api_key = os.getenv("LNBITS_API_KEY")
    wallet_id = os.getenv("LNBITS_WALLET_ID")

    missing = [
        name
        for name, value in (
            ("LNBITS_API_URL", api_url),
            ("LNBITS_API_KEY", api_key),
            ("LNBITS_WALLET_ID", wallet_id),
        )
        if not (value and value.strip())
    ]
    if missing:
        formatted = ", ".join(missing)
        msg = f"Missing required payment environment variables: {formatted}."
        raise PaymentsConfigurationError(msg)

    settings = LnBitsSettings(
        api_url=_normalize_base_url(api_url.strip()),
        api_key=api_key.strip(),
        wallet_id=wallet_id.strip(),
    )
    return PaymentSettings(provider=provider, lnbits=settings)


def clear_payment_settings_cache() -> None:
    """Reset cached payment provider configuration. Intended for tests."""

    get_payment_settings.cache_clear()


class NostrPublisherConfigurationError(RuntimeError):
    """Raised when release note publisher settings cannot be loaded."""


@dataclass(frozen=True)
class NostrPublisherSettings:
    """Configuration describing how release notes are published to relays."""

    relays: Tuple[str, ...]
    platform_pubkey: str
    private_key: int
    public_web_url: str
    platform_lnurl: str | None
    request_timeout: float
    backoff_seconds: int
    backoff_cap_seconds: int
    circuit_breaker_attempts: int

    @classmethod
    def from_environment(cls) -> "NostrPublisherSettings":
        """Build release note publisher settings from environment variables."""

        relays = cls._parse_relays(os.getenv("NOSTR_RELAYS"))
        pubkey = cls._parse_pubkey(os.getenv("PLATFORM_PUBKEY"))
        private_key = cls._load_private_key()

        web_url = os.getenv("PUBLIC_WEB_URL", DEFAULT_PUBLIC_WEB_URL)
        web_url = web_url.strip() or DEFAULT_PUBLIC_WEB_URL
        web_url = web_url.rstrip("/")

        lnurl = os.getenv("PLATFORM_LNURL")
        lnurl_value = lnurl.strip() if lnurl and lnurl.strip() else None

        timeout = _parse_float(
            os.getenv("NOSTR_PUBLISHER_TIMEOUT"),
            default=DEFAULT_NOSTR_REQUEST_TIMEOUT_SECONDS,
        )
        backoff = max(
            1,
            _parse_int(
                os.getenv("NOSTR_PUBLISHER_BACKOFF_SECONDS"),
                default=DEFAULT_NOSTR_BACKOFF_SECONDS,
            ),
        )
        backoff_cap = max(
            backoff,
            _parse_int(
                os.getenv("NOSTR_PUBLISHER_BACKOFF_CAP_SECONDS"),
                default=DEFAULT_NOSTR_BACKOFF_CAP_SECONDS,
            ),
        )
        circuit_attempts = max(
            1,
            _parse_int(
                os.getenv("NOSTR_PUBLISHER_CIRCUIT_BREAKER_ATTEMPTS"),
                default=DEFAULT_NOSTR_CIRCUIT_BREAKER_ATTEMPTS,
            ),
        )

        return cls(
            relays=relays,
            platform_pubkey=pubkey,
            private_key=private_key,
            public_web_url=web_url,
            platform_lnurl=lnurl_value,
            request_timeout=timeout,
            backoff_seconds=backoff,
            backoff_cap_seconds=backoff_cap,
            circuit_breaker_attempts=circuit_attempts,
        )

    @staticmethod
    def _parse_relays(raw_relays: str | None) -> Tuple[str, ...]:
        """Return a normalised tuple of relay URLs or raise when missing."""

        if not raw_relays:
            msg = "NOSTR_RELAYS must define at least one relay URL."
            raise NostrPublisherConfigurationError(msg)

        relays = tuple(item.strip() for item in raw_relays.split(",") if item.strip())
        if not relays:
            msg = "NOSTR_RELAYS must define at least one relay URL."
            raise NostrPublisherConfigurationError(msg)
        return relays

    @staticmethod
    def _parse_pubkey(raw_pubkey: str | None) -> str:
        """Validate that the configured platform public key is hex encoded."""

        if not raw_pubkey:
            msg = "PLATFORM_PUBKEY must be configured as a 64 character hex string."
            raise NostrPublisherConfigurationError(msg)

        candidate = raw_pubkey.strip().lower()
        if len(candidate) != 64 or any(char not in "0123456789abcdef" for char in candidate):
            msg = "PLATFORM_PUBKEY must be configured as a 64 character hex string."
            raise NostrPublisherConfigurationError(msg)
        return candidate

    @staticmethod
    def _load_private_key() -> int:
        """Return the platform signing key as an integer suitable for Schnorr signing."""

        path_value = os.getenv("PLATFORM_SIGNING_KEY_PATH")
        if path_value:
            try:
                raw = Path(path_value).read_text(encoding="utf-8")
            except OSError as exc:  # pragma: no cover - defensive
                msg = "Failed to read platform signing key file."
                raise NostrPublisherConfigurationError(msg) from exc
            candidate = raw.strip()
        else:
            candidate = (os.getenv("PLATFORM_SIGNING_KEY_HEX") or "").strip()
            if not candidate:
                msg = (
                    "Provide PLATFORM_SIGNING_KEY_PATH or PLATFORM_SIGNING_KEY_HEX with a 64 character hex value."
                )
                raise NostrPublisherConfigurationError(msg)

        lowered = candidate.lower()
        if lowered.startswith("nsec"):
            msg = "Platform signing key must be provided as hex, not an nsec bech32 string."
            raise NostrPublisherConfigurationError(msg)

        if len(lowered) != 64 or any(char not in "0123456789abcdef" for char in lowered):
            msg = "Platform signing key must be a 64 character hexadecimal string."
            raise NostrPublisherConfigurationError(msg)

        try:
            key_int = int(lowered, 16)
        except ValueError as exc:  # pragma: no cover - defensive
            msg = "Platform signing key must be a 64 character hexadecimal string."
            raise NostrPublisherConfigurationError(msg) from exc

        if not 1 <= key_int < SECP256K1_N:
            msg = "Platform signing key is outside the valid secp256k1 range."
            raise NostrPublisherConfigurationError(msg)

        return key_int


@lru_cache(maxsize=1)
def get_nostr_publisher_settings() -> NostrPublisherSettings:
    """Return cached release note publisher configuration."""

    return NostrPublisherSettings.from_environment()


def clear_nostr_publisher_settings_cache() -> None:
    """Reset cached release note publisher settings. Intended for tests."""

    get_nostr_publisher_settings.cache_clear()


@dataclass(frozen=True)
class NostrIngestorSettings:
    """Configuration describing how release note replies are ingested from relays."""

    relays: Tuple[str, ...]
    request_timeout: float
    batch_limit: int
    lookback_seconds: int

    @classmethod
    def from_environment(cls) -> "NostrIngestorSettings":
        """Build release note ingestion settings from environment variables."""

        relays = NostrPublisherSettings._parse_relays(os.getenv("NOSTR_RELAYS"))
        timeout = _parse_float(
            os.getenv("NOSTR_INGESTION_TIMEOUT"),
            default=DEFAULT_NOSTR_INGESTION_TIMEOUT_SECONDS,
        )
        batch_limit = max(
            1,
            _parse_int(
                os.getenv("NOSTR_INGESTION_BATCH_LIMIT"),
                default=DEFAULT_NOSTR_INGESTION_BATCH_LIMIT,
            ),
        )
        lookback = max(
            0,
            _parse_int(
                os.getenv("NOSTR_INGESTION_LOOKBACK_SECONDS"),
                default=DEFAULT_NOSTR_INGESTION_LOOKBACK_SECONDS,
            ),
        )
        return cls(
            relays=relays,
            request_timeout=timeout,
            batch_limit=batch_limit,
            lookback_seconds=lookback,
        )


@lru_cache(maxsize=1)
def get_nostr_ingestor_settings() -> NostrIngestorSettings:
    """Return cached release note ingestion configuration."""

    return NostrIngestorSettings.from_environment()


def clear_nostr_ingestor_settings_cache() -> None:
    """Reset cached release note ingestor settings. Intended for tests."""

    get_nostr_ingestor_settings.cache_clear()
