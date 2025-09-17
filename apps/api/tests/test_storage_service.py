"""Unit tests for the storage service helper class."""

from __future__ import annotations

from datetime import datetime, timezone

from proof_of_play_api.services.storage import (
    GameAssetKind,
    PresignedDownload,
    StorageService,
)


class _RecordingClient:
    """Minimal stub that records calls to ``generate_presigned_post``."""

    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []
        self.download_calls: list[dict[str, object]] = []

    def generate_presigned_post(self, **kwargs: object) -> dict[str, object]:
        self.calls.append(kwargs)
        key = kwargs["Key"]
        return {
            "url": "http://localhost:9000/pop-games",
            "fields": {"key": key, "policy": "encoded", "Content-Type": kwargs.get("Fields", {}).get("Content-Type", "")},
        }

    def generate_presigned_url(
        self, ClientMethod: str, Params: dict[str, object], ExpiresIn: int
    ) -> str:
        self.download_calls.append(
            {
                "ClientMethod": ClientMethod,
                "Params": Params,
                "ExpiresIn": ExpiresIn,
            }
        )
        return f"http://localhost:9000/pop-games/{Params['Key']}?signature=abc"


def test_generate_game_asset_upload_includes_expected_conditions() -> None:
    """The storage service should include provided metadata in the presigned payload."""

    client = _RecordingClient()
    service = StorageService(
        client=client,
        bucket="pop-games",
        presign_expiration=600,
        public_base_url="http://localhost:9000/pop-games",
    )

    upload = service.generate_game_asset_upload(
        game_id="game-123",
        asset=GameAssetKind.BUILD,
        filename="Build.ZIP",
        content_type="application/zip",
        max_bytes=2048,
    )

    assert upload.object_key.startswith("games/game-123/build/")
    assert upload.object_key.endswith(".zip")
    assert upload.public_url.endswith(upload.object_key)
    assert upload.fields["key"] == upload.object_key

    assert client.calls
    call = client.calls[0]
    assert call["Bucket"] == "pop-games"
    assert call["Key"] == upload.object_key
    assert call["ExpiresIn"] == 600
    assert call["Fields"]["Content-Type"] == "application/zip"
    assert ["content-length-range", 0, 2048] in call["Conditions"]


def test_build_asset_key_handles_cover_extensions() -> None:
    """Cover uploads should use a dedicated directory and lower-case file extension."""

    client = _RecordingClient()
    service = StorageService(
        client=client,
        bucket="pop-games",
        presign_expiration=600,
        public_base_url="http://localhost:9000/pop-games",
    )

    key = service.build_asset_key(game_id="abc", asset=GameAssetKind.COVER, filename="Promo.PNG")

    assert key.startswith("games/abc/cover/")
    assert key.endswith(".png")


def test_create_presigned_download_returns_expiring_url() -> None:
    """Generating a download link should call the client and record expiration."""

    client = _RecordingClient()
    service = StorageService(
        client=client,
        bucket="pop-games",
        presign_expiration=900,
        public_base_url="http://localhost:9000/pop-games",
    )

    download = service.create_presigned_download(object_key="games/xyz/build/archive.zip")

    assert isinstance(download, PresignedDownload)
    assert download.url.startswith("http://localhost:9000/pop-games/games/xyz/build/")
    assert download.url.endswith("?signature=abc")
    assert download.expires_at > datetime.now(timezone.utc)

    assert client.download_calls
    call = client.download_calls[0]
    assert call["ClientMethod"] == "get_object"
    assert call["Params"] == {"Bucket": "pop-games", "Key": "games/xyz/build/archive.zip"}
    assert call["ExpiresIn"] == 900
