"""Proof-of-work validation utilities for throttling low reputation activity."""

from __future__ import annotations

import hashlib
import logging
from typing import Final

from proof_of_play_api.db.models import User
from proof_of_play_api.schemas.security import ProofOfWorkSubmission


logger = logging.getLogger(__name__)

PROOF_OF_WORK_REPUTATION_THRESHOLD: Final[int] = 10
"""Reputation required before proof-of-work checks are skipped."""

PROOF_OF_WORK_DIFFICULTY_BITS: Final[int] = 12
"""Number of leading zero bits required in the work hash."""


class ProofOfWorkValidationError(ValueError):
    """Raised when proof-of-work data is missing or does not meet difficulty."""

    def __init__(self, message: str) -> None:
        """Store the validation error message."""

        super().__init__(message)


def count_leading_zero_bits(digest: bytes) -> int:
    """Return the number of leading zero bits present in ``digest``."""

    total = 0
    for byte in digest:
        if byte == 0:
            total += 8
            continue

        leading = 8 - byte.bit_length()
        total += leading
        break

    return total


def calculate_proof_of_work_hash(
    *, user_id: str, resource_id: str, payload: str, nonce: int
) -> bytes:
    """Return the SHA-256 hash for the provided proof-of-work inputs."""

    message = f"{user_id}:{resource_id}:{payload}:{nonce}".encode("utf-8")
    return hashlib.sha256(message).digest()


def enforce_proof_of_work(
    *,
    user: User,
    resource_id: str,
    payload: str,
    proof: ProofOfWorkSubmission | None,
) -> None:
    """Validate that the request satisfies proof-of-work requirements."""

    if user.reputation_score >= PROOF_OF_WORK_REPUTATION_THRESHOLD:
        return

    if proof is None:
        msg = "Proof of work is required for low reputation accounts."
        raise ProofOfWorkValidationError(msg)

    digest = calculate_proof_of_work_hash(
        user_id=user.id, resource_id=resource_id, payload=payload, nonce=proof.nonce
    )
    leading_zero_bits = count_leading_zero_bits(digest)

    if leading_zero_bits < PROOF_OF_WORK_DIFFICULTY_BITS:
        msg = (
            "Provided proof of work does not satisfy the required difficulty."
        )
        logger.info(
            "proof_of_work_rejected",
            extra={
                "user_id": user.id,
                "resource_id": resource_id,
                "difficulty_bits": PROOF_OF_WORK_DIFFICULTY_BITS,
                "observed_bits": leading_zero_bits,
            },
        )
        raise ProofOfWorkValidationError(msg)


__all__ = [
    "PROOF_OF_WORK_DIFFICULTY_BITS",
    "PROOF_OF_WORK_REPUTATION_THRESHOLD",
    "ProofOfWorkValidationError",
    "calculate_proof_of_work_hash",
    "count_leading_zero_bits",
    "enforce_proof_of_work",
]

