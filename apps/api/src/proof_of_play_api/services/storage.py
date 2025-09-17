"""Helpers for generating pre-signed upload URLs for object storage."""

from __future__ import annotations

import enum
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import PurePath
from typing import Any, Protocol

try:
    import boto3
    from botocore.config import Config
except ModuleNotFoundError:  # pragma: no cover - optional dependency guard
    boto3 = None  # type: ignore[assignment]
    Config = None  # type: ignore[assignment]

from proof_of_play_api.core.config import StorageSettings, get_storage_settings


class _PresignClient(Protocol):
    """Protocol describing the subset of the S3 client used for presigning."""

    def generate_presigned_post(self, **kwargs: Any) -> dict[str, Any]:
        """Return a dictionary describing a pre-signed POST upload."""

    def generate_presigned_url(
        self, ClientMethod: str, Params: dict[str, Any], ExpiresIn: int
    ) -> str:
        """Return a pre-signed URL for the requested client method."""


class GameAssetKind(str, enum.Enum):
    """Enumerate the supported asset types for a game listing."""

    COVER = "cover"
    BUILD = "build"


@dataclass(frozen=True)
class PresignedUpload:
    """Representation of the information required to perform an upload."""

    upload_url: str
    fields: dict[str, str]
    object_key: str
    public_url: str


@dataclass(frozen=True)
class PresignedDownload:
    """Representation of a time limited download link."""

    url: str
    expires_at: datetime


class StorageService:
    """Business logic for issuing upload credentials for object storage."""

    def __init__(
        self,
        *,
        client: _PresignClient,
        bucket: str,
        presign_expiration: int,
        public_base_url: str,
    ) -> None:
        self._client = client
        self._bucket = bucket
        self._presign_expiration = presign_expiration
        self._public_base_url = public_base_url.rstrip("/")

    def generate_game_asset_upload(
        self,
        *,
        game_id: str,
        asset: GameAssetKind,
        filename: str,
        content_type: str | None = None,
        max_bytes: int | None = None,
    ) -> PresignedUpload:
        """Return pre-signed upload data for the requested game asset."""

        object_key = self.build_asset_key(game_id=game_id, asset=asset, filename=filename)
        return self.create_presigned_upload(
            object_key=object_key,
            content_type=content_type,
            max_bytes=max_bytes,
        )

    def create_presigned_upload(
        self,
        *,
        object_key: str,
        content_type: str | None = None,
        max_bytes: int | None = None,
    ) -> PresignedUpload:
        """Return pre-signed POST data for a storage object upload."""

        fields: dict[str, str] = {}
        conditions: list[Any] = []

        if content_type:
            fields["Content-Type"] = content_type
            conditions.append({"Content-Type": content_type})

        if max_bytes is not None:
            conditions.append(["content-length-range", 0, max_bytes])

        params: dict[str, Any] = {
            "Bucket": self._bucket,
            "Key": object_key,
            "ExpiresIn": self._presign_expiration,
        }
        if fields:
            params["Fields"] = fields
        if conditions:
            params["Conditions"] = conditions

        response = self._client.generate_presigned_post(**params)
        return PresignedUpload(
            upload_url=response["url"],
            fields={str(key): str(value) for key, value in response["fields"].items()},
            object_key=object_key,
            public_url=self.build_public_url(object_key),
        )

    def create_presigned_download(self, *, object_key: str) -> PresignedDownload:
        """Return a time limited download link for the specified object key."""

        expires_at = datetime.now(timezone.utc) + timedelta(seconds=self._presign_expiration)
        url = self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": object_key},
            ExpiresIn=self._presign_expiration,
        )
        return PresignedDownload(url=url, expires_at=expires_at)

    def build_asset_key(self, *, game_id: str, asset: GameAssetKind, filename: str) -> str:
        """Return an object key suitable for storing the requested asset."""

        suffix = PurePath(filename).suffix.lower()
        token = uuid.uuid4().hex
        directory = "cover" if asset is GameAssetKind.COVER else "build"
        return f"games/{game_id}/{directory}/{token}{suffix}"

    def build_public_url(self, object_key: str) -> str:
        """Return the public URL for the supplied object key."""

        return f"{self._public_base_url}/{object_key}"


def _create_s3_client(settings: StorageSettings) -> _PresignClient:
    """Instantiate a boto3 S3 client for presigned upload generation."""

    if boto3 is None or Config is None:  # pragma: no cover - dependency guard
        msg = "boto3 is required to use the S3 storage backend."
        raise RuntimeError(msg)

    session = boto3.session.Session()
    region = settings.region if settings.region.lower() != "auto" else None
    return session.client(
        "s3",
        region_name=region,
        endpoint_url=settings.endpoint_url,
        aws_access_key_id=settings.access_key,
        aws_secret_access_key=settings.secret_key,
        config=Config(signature_version="s3v4"),
    )


@lru_cache(maxsize=1)
def get_storage_service() -> StorageService:
    """Return a cached `StorageService` instance configured from the environment."""

    settings = get_storage_settings()
    client = _create_s3_client(settings)
    return StorageService(
        client=client,
        bucket=settings.bucket,
        presign_expiration=settings.presign_expiration,
        public_base_url=settings.public_base_url,
    )


def reset_storage_service() -> None:
    """Clear the cached storage service. Intended for use in tests."""

    get_storage_service.cache_clear()


__all__ = [
    "GameAssetKind",
    "PresignedUpload",
    "StorageService",
    "get_storage_service",
    "reset_storage_service",
]
