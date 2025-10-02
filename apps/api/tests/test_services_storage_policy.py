import pytest

from bit_indie_api.services.storage import GameAssetKind
from bit_indie_api.services.storage_policy import (
    AssetUploadValidationError,
    GameAssetUploadValidator,
    ValidatedAssetUpload,
)


def test_validator_infers_image_content_type() -> None:
    """Image uploads should infer the correct content type when omitted."""

    validator = GameAssetUploadValidator(build_size_limit=10 * 1024 * 1024)

    result = validator.validate(
        asset=GameAssetKind.COVER,
        filename="promo.PNG",
        content_type=None,
        file_size=1024,
    )

    assert isinstance(result, ValidatedAssetUpload)
    assert result.content_type == "image/png"
    assert result.max_bytes == 1024


def test_validator_rejects_unsupported_extension() -> None:
    """Unsupported file extensions should raise a validation error."""

    validator = GameAssetUploadValidator(build_size_limit=10 * 1024 * 1024)

    with pytest.raises(AssetUploadValidationError):
        validator.validate(
            asset=GameAssetKind.COVER,
            filename="promo.gif",
            content_type="image/gif",
            file_size=512,
        )


def test_validator_enforces_file_size_limit() -> None:
    """Build uploads exceeding the configured size limit should be rejected."""

    validator = GameAssetUploadValidator(build_size_limit=2048)

    with pytest.raises(AssetUploadValidationError):
        validator.validate(
            asset=GameAssetKind.BUILD,
            filename="release.zip",
            content_type="application/zip",
            file_size=4096,
        )


def test_validator_normalizes_content_type() -> None:
    """Content type parameters should be ignored during validation."""

    validator = GameAssetUploadValidator(build_size_limit=10 * 1024 * 1024)

    result = validator.validate(
        asset=GameAssetKind.HERO,
        filename="hero.webp",
        content_type="image/webp; charset=utf-8",
        file_size=1500,
    )

    assert result.content_type == "image/webp"
    assert result.max_bytes == 1500
