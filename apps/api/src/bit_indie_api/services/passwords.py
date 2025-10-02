"""Helpers for hashing and verifying user account passwords."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass


PBKDF2_ALGORITHM = "sha256"
PBKDF2_DEFAULT_ITERATIONS = 480_000
PBKDF2_KEY_LENGTH = 32
PBKDF2_SALT_BYTES = 16
PASSWORD_HASH_SCHEME = "pbkdf2_sha256"


@dataclass(frozen=True)
class ParsedPasswordHash:
    """Decoded components from a stored password hash."""

    iterations: int
    salt: bytes
    checksum: bytes


def _urlsafe_b64encode(value: bytes) -> str:
    """Return a URL-safe base64 string without padding characters."""

    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _urlsafe_b64decode(value: str) -> bytes:
    """Decode a URL-safe base64 string that may omit padding."""

    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def hash_password(password: str, *, iterations: int = PBKDF2_DEFAULT_ITERATIONS) -> str:
    """Return a PBKDF2 hashed representation of ``password`` suitable for storage."""

    if not password:
        msg = "Password must not be empty."
        raise ValueError(msg)
    if iterations <= 0:
        msg = "Password hashing iterations must be greater than zero."
        raise ValueError(msg)

    salt = secrets.token_bytes(PBKDF2_SALT_BYTES)
    derived = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        salt,
        iterations,
        dklen=PBKDF2_KEY_LENGTH,
    )
    encoded_salt = _urlsafe_b64encode(salt)
    encoded_checksum = _urlsafe_b64encode(derived)
    return f"{PASSWORD_HASH_SCHEME}${iterations}${encoded_salt}${encoded_checksum}"


def _parse_password_hash(password_hash: str) -> ParsedPasswordHash | None:
    """Decode the stored hash format returning its constituent parts."""

    try:
        scheme, iterations_str, salt_part, checksum_part = password_hash.split("$")
    except ValueError:
        return None

    if scheme != PASSWORD_HASH_SCHEME:
        return None

    try:
        iterations = int(iterations_str)
        salt = _urlsafe_b64decode(salt_part)
        checksum = _urlsafe_b64decode(checksum_part)
    except (ValueError, base64.binascii.Error):
        return None

    if iterations <= 0 or not salt or not checksum:
        return None

    return ParsedPasswordHash(iterations=iterations, salt=salt, checksum=checksum)


def verify_password(password: str, password_hash: str) -> bool:
    """Return ``True`` when ``password`` matches ``password_hash``."""

    parsed = _parse_password_hash(password_hash)
    if parsed is None:
        return False

    candidate = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        parsed.salt,
        parsed.iterations,
        dklen=len(parsed.checksum),
    )
    return hmac.compare_digest(candidate, parsed.checksum)


__all__ = [
    "hash_password",
    "verify_password",
    "PBKDF2_DEFAULT_ITERATIONS",
]
