"""Upload production-ready media assets for seeded game catalogs."""

from __future__ import annotations

import mimetypes
from pathlib import Path

import boto3

from bit_indie_api.core.config import get_storage_settings
from bit_indie_api.db import session_scope
from bit_indie_api.db.models import Game
from bit_indie_api.scripts.seed_simple_mvp import (
    GAME_MEDIA_SLUGS,
    _media_object_key,
    _media_url,
)


ASSET_TYPES = ("cover", "hero", "receipt_thumbnail")
ASSET_GLOB_PATTERNS = {
    "receipt_thumbnail": "receipt.*",
}
ASSET_ROOT = Path(__file__).resolve().parents[3] / "assets" / "media"


def _resolve_local_asset(slug: str, asset: str) -> Path:
    """Return the local asset file path for the provided slug and asset type."""

    directory = ASSET_ROOT / slug
    if not directory.is_dir():
        msg = f"Missing local asset directory for slug '{slug}'"
        raise FileNotFoundError(msg)

    pattern = ASSET_GLOB_PATTERNS.get(asset, f"{asset}.*")
    matches = sorted(directory.glob(pattern))
    if not matches:
        msg = f"Missing local asset file for slug '{slug}' and asset '{asset}'"
        raise FileNotFoundError(msg)

    return matches[0]


def _create_storage_client():
    """Instantiate a boto3 S3 client using storage settings."""

    settings = get_storage_settings()
    session = boto3.session.Session()
    region = settings.region if settings.region.lower() != "auto" else None
    return session.client(
        "s3",
        region_name=region,
        endpoint_url=settings.endpoint_url,
        aws_access_key_id=settings.access_key,
        aws_secret_access_key=settings.secret_key,
    )


def seed() -> None:
    """Upload curated media assets and sync URLs on seeded games."""

    storage = _create_storage_client()
    settings = get_storage_settings()

    with session_scope() as session:
        for game_id, slug in GAME_MEDIA_SLUGS.items():
            game = session.get(Game, game_id)
            if game is None:
                continue

            for asset in ASSET_TYPES:
                object_key = _media_object_key(game_id=game_id, slug=slug, asset=asset)
                file_path = _resolve_local_asset(slug, asset)
                content_type, _ = mimetypes.guess_type(file_path.name)
                extra_args = {"ContentType": content_type or "application/octet-stream"}

                with file_path.open("rb") as handle:
                    storage.upload_fileobj(handle, settings.bucket, object_key, ExtraArgs=extra_args)

                url = _media_url(object_key)
                if asset == "cover":
                    game.cover_url = url
                elif asset == "hero":
                    game.hero_url = url
                elif asset == "receipt_thumbnail":
                    game.receipt_thumbnail_url = url

    print("Uploaded media assets for", ", ".join(GAME_MEDIA_SLUGS.values()))


__all__ = ["seed"]

