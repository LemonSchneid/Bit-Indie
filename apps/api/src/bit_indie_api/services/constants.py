"""Common constants shared across service modules."""

from __future__ import annotations

ALLOWED_BUILD_ARCHIVE_EXTENSIONS: tuple[str, ...] = (
    ".zip",
    ".tar.gz",
    ".tar.xz",
    ".tar.bz2",
)

__all__ = ["ALLOWED_BUILD_ARCHIVE_EXTENSIONS"]
