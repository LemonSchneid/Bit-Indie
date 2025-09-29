from __future__ import annotations

from bit_indie_api.services.comment_thread.utils import encode_npub


def test_encode_npub_returns_none_for_invalid_hex() -> None:
    """Non-hexadecimal values should return None."""

    assert encode_npub("not-hex") is None


def test_encode_npub_round_trip() -> None:
    """Valid hex public keys should encode to an npub prefix."""

    pubkey = "a" * 64
    npub = encode_npub(pubkey)
    assert npub is not None
    assert npub.startswith("npub1")


def test_encode_npub_rejects_short_values() -> None:
    """Values shorter than 32 bytes are considered invalid."""

    assert encode_npub("abcd") is None
