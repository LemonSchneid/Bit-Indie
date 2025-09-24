"""Utility helpers supporting comment thread collaborators."""

from __future__ import annotations

import json
from collections.abc import Iterable, Sequence

_BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
_AUTHOR_ALIAS_TAG_NAMES = {"alias", "npub"}


def normalize_hex_key(value: str | None) -> str | None:
    """Return a lowercase hex string when the input resembles a pubkey."""

    if value is None:
        return None
    candidate = value.strip()
    if len(candidate) != 64:
        return None
    try:
        bytes.fromhex(candidate)
    except ValueError:
        return None
    return candidate.lower()


def normalize_pubkey_value(value: object) -> str | None:
    """Return a normalized hex pubkey when the value represents a pubkey."""

    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    trimmed = trimmed.removeprefix("nostr:")
    normalized = normalize_hex_key(trimmed)
    if normalized:
        return normalized
    lowered = trimmed.lower()
    if lowered.startswith("npub"):
        try:
            decoded = decode_npub(trimmed)
        except ValueError:
            return None
        return decoded.hex()
    return None


def extract_alias_pubkeys(
    tags_json: str | None, primary_pubkey: str | None
) -> tuple[str, ...]:
    """Return normalized pubkeys referenced by the reply tags."""

    aliases: set[str] = set()
    normalized_primary = primary_pubkey.lower() if primary_pubkey else None
    if normalized_primary is None:
        return tuple()
    aliases.add(normalized_primary)
    if not tags_json:
        return tuple(sorted(aliases))
    try:
        tags = json.loads(tags_json)
    except (TypeError, json.JSONDecodeError):
        return tuple(sorted(aliases))
    candidate_aliases: set[str] = set()
    for tag in tags:
        if not isinstance(tag, Sequence) or len(tag) < 2:
            continue
        name = tag[0]
        if not isinstance(name, str) or name.lower() not in _AUTHOR_ALIAS_TAG_NAMES:
            continue
        for value in tag[1:]:
            normalized = normalize_pubkey_value(value)
            if normalized:
                candidate_aliases.add(normalized)
    aliases.update(alias for alias in candidate_aliases if alias == normalized_primary)
    return tuple(sorted(aliases))


def decode_npub(value: str) -> bytes:
    """Decode an npub bech32 string into raw public key bytes."""

    hrp, words = _bech32_decode(value)
    if hrp != "npub":
        raise ValueError("Unexpected bech32 prefix")
    data = _convertbits(words, 5, 8, False)
    return bytes(data)


def encode_npub(pubkey_hex: str | None) -> str | None:
    """Encode a hex public key into its bech32 npub representation."""

    if not pubkey_hex:
        return None
    try:
        raw = bytes.fromhex(pubkey_hex)
    except ValueError:
        return None
    words = _convertbits(raw, 8, 5, True)
    return _bech32_encode("npub", words)


def _bech32_hrp_expand(hrp: str) -> list[int]:
    return [ord(char) >> 5 for char in hrp] + [0] + [ord(char) & 31 for char in hrp]


def _bech32_polymod(values: Iterable[int]) -> int:
    generator = [0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3]
    chk = 1
    for value in values:
        if value < 0 or value > 31:
            raise ValueError("bech32 values must be 5-bit integers")
        top = chk >> 25
        chk = ((chk & 0x1FFFFFF) << 5) ^ value
        for index, polymod in enumerate(generator):
            if (top >> index) & 1:
                chk ^= polymod
    return chk


def _bech32_verify_checksum(hrp: str, values: Sequence[int]) -> bool:
    return _bech32_polymod(_bech32_hrp_expand(hrp) + list(values)) == 1


def _bech32_create_checksum(hrp: str, values: Sequence[int]) -> list[int]:
    payload = _bech32_hrp_expand(hrp) + list(values) + [0, 0, 0, 0, 0, 0]
    polymod = _bech32_polymod(payload) ^ 1
    return [(polymod >> 5 * (5 - index)) & 31 for index in range(6)]


def _bech32_encode(hrp: str, data: Sequence[int]) -> str:
    combined = list(data) + _bech32_create_checksum(hrp, data)
    return hrp + "1" + "".join(_BECH32_ALPHABET[digit] for digit in combined)


def _bech32_decode(value: str) -> tuple[str, list[int]]:
    if any(ord(char) < 33 or ord(char) > 126 for char in value):
        raise ValueError("Invalid bech32 characters")
    if value.lower() != value and value.upper() != value:
        raise ValueError("Mixed case bech32 strings are invalid")
    lower = value.lower()
    separator = lower.rfind("1")
    if separator == -1 or separator < 1 or separator + 7 > len(lower):
        raise ValueError("Invalid bech32 format")
    hrp = lower[:separator]
    data_part = lower[separator + 1 :]
    data: list[int] = []
    for char in data_part:
        try:
            data.append(_BECH32_ALPHABET.index(char))
        except ValueError as exc:
            raise ValueError("Invalid bech32 character") from exc
    if not _bech32_verify_checksum(hrp, data):
        raise ValueError("Invalid bech32 checksum")
    return hrp, data[:-6]


def _convertbits(
    data: Iterable[int] | bytes, from_bits: int, to_bits: int, pad: bool
) -> list[int]:
    """General power-of-two base conversion supporting bech32 encoding."""

    acc = 0
    bits = 0
    ret: list[int] = []
    maxv = (1 << to_bits) - 1
    max_acc = (1 << (from_bits + to_bits - 1)) - 1
    for value in data:
        if isinstance(value, bytes):
            raise TypeError("Nested byte iterables are not supported")
        if value < 0 or value >> from_bits:
            raise ValueError("Input value out of range")
        acc = ((acc << from_bits) | value) & max_acc
        bits += from_bits
        while bits >= to_bits:
            bits -= to_bits
            ret.append((acc >> bits) & maxv)
    if pad and bits:
        ret.append((acc << (to_bits - bits)) & maxv)
    elif not pad and (bits >= from_bits or ((acc << (to_bits - bits)) & maxv)):
        raise ValueError("Invalid padding")
    return ret


__all__ = [
    "decode_npub",
    "encode_npub",
    "extract_alias_pubkeys",
    "normalize_hex_key",
    "normalize_pubkey_value",
]
