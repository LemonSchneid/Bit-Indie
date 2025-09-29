"""Helpers for formatting comment author metadata."""

from __future__ import annotations

from typing import Iterable, Sequence

_BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def encode_npub(pubkey_hex: str | None) -> str | None:
    """Encode a hex public key into its bech32 npub representation."""

    if not pubkey_hex:
        return None
    if len(pubkey_hex) != 64:
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


def _bech32_create_checksum(hrp: str, values: Sequence[int]) -> list[int]:
    payload = _bech32_hrp_expand(hrp) + list(values) + [0, 0, 0, 0, 0, 0]
    polymod = _bech32_polymod(payload) ^ 1
    return [(polymod >> 5 * (5 - index)) & 31 for index in range(6)]


def _bech32_encode(hrp: str, data: Sequence[int]) -> str:
    combined = list(data) + _bech32_create_checksum(hrp, data)
    return hrp + "1" + "".join(_BECH32_ALPHABET[digit] for digit in combined)


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


__all__ = ["encode_npub"]
