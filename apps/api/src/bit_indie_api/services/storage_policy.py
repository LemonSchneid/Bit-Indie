"""Validation helpers for enforcing safe game asset upload parameters."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable

from bit_indie_api.core.config import get_settings
from bit_indie_api.services.constants import ALLOWED_BUILD_ARCHIVE_EXTENSIONS
from bit_indie_api.services.storage import GameAssetKind


class AssetUploadValidationError(ValueError):
    """Raised when a requested asset upload violates safety requirements."""


@dataclass(frozen=True)
class AssetUploadPolicy:
    """Describe the allowed metadata for a game asset upload."""

    allowed_extensions: tuple[str, ...]
    allowed_content_types: tuple[str, ...]
    max_bytes: int


@dataclass(frozen=True)
class ValidatedAssetUpload:
    """Return value from validating an upload request."""

    content_type: str | None
    max_bytes: int


class GameAssetUploadValidator:
    """Validate filenames, content types, and sizes for game asset uploads."""

    _IMAGE_EXTENSIONS: tuple[str, ...] = (".png", ".jpg", ".jpeg", ".webp", ".svg")
    _IMAGE_CONTENT_TYPES: tuple[str, ...] = (
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
    )
    _BUILD_EXTENSIONS: tuple[str, ...] = ALLOWED_BUILD_ARCHIVE_EXTENSIONS
    _BUILD_CONTENT_TYPES: tuple[str, ...] = (
        "application/zip",
        "application/x-zip-compressed",
        "application/gzip",
        "application/x-tar",
        "application/x-xz",
        "application/x-bzip2",
    )

    _EXTENSION_CONTENT_TYPE_MAP: dict[str, str] = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".zip": "application/zip",
        ".tar.gz": "application/gzip",
        ".tar.xz": "application/x-xz",
        ".tar.bz2": "application/x-bzip2",
    }

    def __init__(self, *, build_size_limit: int | None = None) -> None:
        settings = get_settings()
        self._build_size_limit = (
            build_size_limit
            if build_size_limit is not None
            else settings.max_build_size_bytes
        )

    def validate(
        self,
        *,
        asset: GameAssetKind,
        filename: str,
        content_type: str | None,
        file_size: int | None,
    ) -> ValidatedAssetUpload:
        """Ensure that asset metadata matches the configured policy."""

        policy = self._policy_for(asset)
        extension = self._match_extension(filename=filename, allowed=policy.allowed_extensions)

        normalized_content_type = self._normalize_content_type(content_type)
        if normalized_content_type is None:
            inferred = self._EXTENSION_CONTENT_TYPE_MAP.get(extension)
            if inferred and inferred in policy.allowed_content_types:
                normalized_content_type = inferred
            elif policy.allowed_content_types:
                normalized_content_type = policy.allowed_content_types[0]

        if (
            normalized_content_type
            and policy.allowed_content_types
            and normalized_content_type not in policy.allowed_content_types
        ):
            allowed_display = ", ".join(policy.allowed_content_types)
            msg = f"Content type '{normalized_content_type}' is not allowed. Use: {allowed_display}."
            raise AssetUploadValidationError(msg)

        max_bytes = policy.max_bytes
        if file_size is not None:
            if file_size <= 0:
                raise AssetUploadValidationError("File size must be greater than zero bytes.")
            if file_size > policy.max_bytes:
                formatted_limit = self._format_size(policy.max_bytes)
                msg = f"File exceeds the maximum allowed size of {formatted_limit}."
                raise AssetUploadValidationError(msg)
            max_bytes = file_size

        return ValidatedAssetUpload(content_type=normalized_content_type, max_bytes=max_bytes)

    def _policy_for(self, asset: GameAssetKind) -> AssetUploadPolicy:
        """Return the validation policy for the requested asset kind."""

        if asset is GameAssetKind.BUILD:
            return AssetUploadPolicy(
                allowed_extensions=self._BUILD_EXTENSIONS,
                allowed_content_types=self._BUILD_CONTENT_TYPES,
                max_bytes=self._build_size_limit,
            )

        if asset in {GameAssetKind.COVER, GameAssetKind.HERO, GameAssetKind.RECEIPT_THUMBNAIL}:
            limits = {
                GameAssetKind.COVER: 5 * 1024 * 1024,
                GameAssetKind.HERO: 8 * 1024 * 1024,
                GameAssetKind.RECEIPT_THUMBNAIL: 3 * 1024 * 1024,
            }
            return AssetUploadPolicy(
                allowed_extensions=self._IMAGE_EXTENSIONS,
                allowed_content_types=self._IMAGE_CONTENT_TYPES,
                max_bytes=limits[asset],
            )

        # Default to the most restrictive policy.
        return AssetUploadPolicy(
            allowed_extensions=self._IMAGE_EXTENSIONS,
            allowed_content_types=self._IMAGE_CONTENT_TYPES,
            max_bytes=3 * 1024 * 1024,
        )

    @staticmethod
    def _match_extension(*, filename: str, allowed: Iterable[str]) -> str:
        """Return the allowed extension that matches ``filename``."""

        normalized = filename.strip().lower()
        if not normalized:
            raise AssetUploadValidationError("Filename is required for upload validation.")

        for ext in sorted(allowed, key=len, reverse=True):
            if normalized.endswith(ext):
                return ext

        allowed_display = ", ".join(allowed)
        msg = f"Unsupported file extension. Allowed extensions: {allowed_display}."
        raise AssetUploadValidationError(msg)

    @staticmethod
    def _normalize_content_type(raw: str | None) -> str | None:
        """Normalize a content type string by removing parameters and whitespace."""

        if raw is None:
            return None
        normalized = raw.split(";", 1)[0].strip().lower()
        return normalized or None

    @staticmethod
    def _format_size(value: int) -> str:
        """Return a human-readable representation of ``value`` bytes."""

        units = ["bytes", "KB", "MB", "GB", "TB"]
        size = float(value)
        for unit in units:
            if size < 1024 or unit == units[-1]:
                if unit == "bytes":
                    return f"{int(size)} bytes"
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{value} bytes"


@lru_cache(maxsize=1)
def get_game_asset_upload_validator() -> GameAssetUploadValidator:
    """Return a cached validator for game asset uploads."""

    return GameAssetUploadValidator()


def reset_game_asset_upload_validator() -> None:
    """Clear the cached validator. Primarily intended for tests."""

    get_game_asset_upload_validator.cache_clear()


__all__ = [
    "AssetUploadValidationError",
    "AssetUploadPolicy",
    "GameAssetUploadValidator",
    "ValidatedAssetUpload",
    "get_game_asset_upload_validator",
    "reset_game_asset_upload_validator",
]
