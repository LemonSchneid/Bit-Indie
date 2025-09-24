"""Utilities for working with Nostr events and Schnorr signatures."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Protocol, Sequence


SECP256K1_P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
SECP256K1_GX = 55066263022277343669578718895168534326250603453777594175500187360389116729240
SECP256K1_GY = 32670510020758816978083085130507043184471273380659243275938904335757337482424


class NostrEventLike(Protocol):
    """Protocol describing the required fields from a Nostr event."""

    id: str
    pubkey: str
    created_at: int
    kind: int
    tags: Sequence[Sequence[str]]
    content: str
    sig: str


class InvalidPublicKeyError(ValueError):
    """Raised when a Nostr public key fails validation."""


class InvalidNostrEventError(ValueError):
    """Raised when an event hash does not match its payload."""


class SignatureVerificationError(ValueError):
    """Raised when Schnorr signature verification fails."""


Point = tuple[int, int]


def _tagged_hash(tag: str, data: bytes) -> bytes:
    """Return a tagged hash as defined by BIP-340."""

    tag_hash = hashlib.sha256(tag.encode("utf-8")).digest()
    return hashlib.sha256(tag_hash + tag_hash + data).digest()


def _mod_inverse(value: int, modulus: int) -> int:
    """Compute the modular inverse using Python's built-in exponentiation."""

    return pow(value, -1, modulus)


def _point_add(p1: Point | None, p2: Point | None) -> Point | None:
    """Add two points on the secp256k1 curve."""

    if p1 is None:
        return p2
    if p2 is None:
        return p1

    x1, y1 = p1
    x2, y2 = p2

    if x1 == x2:
        if (y1 + y2) % SECP256K1_P == 0:
            return None
        slope = (3 * x1 * x1 * _mod_inverse(2 * y1 % SECP256K1_P, SECP256K1_P)) % SECP256K1_P
    else:
        slope = ((y2 - y1) % SECP256K1_P) * _mod_inverse((x2 - x1) % SECP256K1_P, SECP256K1_P)
        slope %= SECP256K1_P

    x3 = (slope * slope - x1 - x2) % SECP256K1_P
    y3 = (slope * (x1 - x3) - y1) % SECP256K1_P
    return (x3, y3)


def _point_neg(point: Point | None) -> Point | None:
    """Return the negation of a point on the curve."""

    if point is None:
        return None
    x, y = point
    return (x, (-y) % SECP256K1_P)


def _point_mul(scalar: int, point: Point) -> Point | None:
    """Multiply a point by an integer using double-and-add."""

    if scalar % SECP256K1_N == 0:
        return None

    k = scalar % SECP256K1_N
    result: Point | None = None
    addend: Point | None = point

    while k:
        if k & 1:
            result = _point_add(result, addend)
        addend = _point_add(addend, addend)
        k >>= 1

    return result


def _lift_x(x_coordinate: int) -> Point:
    """Lift an x-coordinate to a point with even y on the secp256k1 curve."""

    if x_coordinate >= SECP256K1_P:
        raise InvalidPublicKeyError("Public key x-coordinate is out of range.")

    y_square = (pow(x_coordinate, 3, SECP256K1_P) + 7) % SECP256K1_P
    y = pow(y_square, (SECP256K1_P + 1) // 4, SECP256K1_P)
    if (y * y - y_square) % SECP256K1_P != 0:
        raise InvalidPublicKeyError("Unable to lift x-coordinate onto the curve.")
    if y % 2 == 1:
        y = SECP256K1_P - y
    return (x_coordinate, y)


def _normalize_secret_key(secret_key: int) -> tuple[int, Point]:
    """Return a secret key and corresponding even-y public point."""

    if not 1 <= secret_key < SECP256K1_N:
        raise ValueError("Secret key must be an integer in [1, curve_order-1].")

    point = _point_mul(secret_key, (SECP256K1_GX, SECP256K1_GY))
    if point is None:
        raise ValueError("Derived public key is the point at infinity.")

    if point[1] % 2 != 0:
        secret_key = SECP256K1_N - secret_key
        point = _point_mul(secret_key, (SECP256K1_GX, SECP256K1_GY))
        if point is None:
            raise ValueError("Failed to derive even-y public key.")

    return secret_key, point


def derive_xonly_public_key(secret_key: int) -> bytes:
    """Return the x-only public key bytes for a given secret key."""

    _, point = _normalize_secret_key(secret_key)
    return point[0].to_bytes(32, "big")


def calculate_event_id(
    *,
    pubkey: str,
    created_at: int,
    kind: int,
    tags: Sequence[Sequence[str]],
    content: str,
) -> str:
    """Return the canonical event id hash for the provided fields."""

    payload = [0, pubkey, created_at, kind, list(tags), content]
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def verify_signed_event(event: NostrEventLike) -> None:
    """Validate the integrity and signature of a signed Nostr event."""

    expected_id = calculate_event_id(
        pubkey=event.pubkey,
        created_at=event.created_at,
        kind=event.kind,
        tags=event.tags,
        content=event.content,
    )
    if not hmac.compare_digest(expected_id, event.id):
        raise InvalidNostrEventError("Event id does not match its contents.")

    if not _verify_schnorr_signature(event.id, event.pubkey, event.sig):
        raise SignatureVerificationError("Invalid Schnorr signature for event.")


def _verify_schnorr_signature(event_id_hex: str, pubkey_hex: str, signature_hex: str) -> bool:
    """Verify a Schnorr signature against a message hash and public key."""

    try:
        message = bytes.fromhex(event_id_hex)
    except ValueError:
        return False

    if len(message) != 32:
        return False

    try:
        pubkey_bytes = bytes.fromhex(pubkey_hex)
    except ValueError:
        return False

    if len(pubkey_bytes) != 32:
        return False

    try:
        signature = bytes.fromhex(signature_hex)
    except ValueError:
        return False

    if len(signature) != 64:
        return False

    r = int.from_bytes(signature[:32], "big")
    s = int.from_bytes(signature[32:], "big")

    if r >= SECP256K1_P or s >= SECP256K1_N:
        return False

    try:
        public_point = _lift_x(int.from_bytes(pubkey_bytes, "big"))
    except InvalidPublicKeyError:
        return False

    challenge_bytes = signature[:32] + pubkey_bytes + message
    e = int.from_bytes(_tagged_hash("BIP0340/challenge", challenge_bytes), "big") % SECP256K1_N

    r_point = _point_add(
        _point_mul(s, (SECP256K1_GX, SECP256K1_GY)),
        _point_neg(_point_mul(e, public_point)),
    )

    if r_point is None:
        return False

    if r_point[1] % 2 != 0:
        return False

    return r_point[0] % SECP256K1_P == r


def schnorr_sign(message: bytes, secret_key: int, aux_rand: bytes | None = None) -> bytes:
    """Produce a BIP-340 Schnorr signature for the provided message."""

    if len(message) != 32:
        raise ValueError("Message must be a 32-byte array.")

    if aux_rand is None:
        aux_rand = bytes(32)
    if len(aux_rand) != 32:
        raise ValueError("Auxiliary randomness must be 32 bytes.")

    normalized_key, public_point = _normalize_secret_key(secret_key)
    public_key_bytes = public_point[0].to_bytes(32, "big")
    secret_key_bytes = normalized_key.to_bytes(32, "big")

    aux_hash = _tagged_hash("BIP0340/aux", aux_rand)
    t = bytes(a ^ b for a, b in zip(secret_key_bytes, aux_hash))

    k0 = int.from_bytes(
        _tagged_hash("BIP0340/nonce", t + public_key_bytes + message),
        "big",
    ) % SECP256K1_N

    if k0 == 0:
        raise ValueError("Generated nonce is zero; retry with different randomness.")

    r_point = _point_mul(k0, (SECP256K1_GX, SECP256K1_GY))
    if r_point is None:
        raise ValueError("Failed to compute nonce point on the curve.")

    if r_point[1] % 2 != 0:
        k0 = SECP256K1_N - k0
        r_point = _point_mul(k0, (SECP256K1_GX, SECP256K1_GY))
        if r_point is None:
            raise ValueError("Failed to adjust nonce point parity.")

    r_bytes = r_point[0].to_bytes(32, "big")
    e = int.from_bytes(
        _tagged_hash("BIP0340/challenge", r_bytes + public_key_bytes + message),
        "big",
    ) % SECP256K1_N

    s = (k0 + e * normalized_key) % SECP256K1_N
    return r_bytes + s.to_bytes(32, "big")


__all__ = [
    "InvalidNostrEventError",
    "InvalidPublicKeyError",
    "SignatureVerificationError",
    "calculate_event_id",
    "derive_xonly_public_key",
    "schnorr_sign",
    "verify_signed_event",
]
