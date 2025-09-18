"""Security-related request payloads such as proof-of-work submissions."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProofOfWorkSubmission(BaseModel):
    """Proof-of-work data supplied by clients to unlock rate-limited actions."""

    nonce: int = Field(..., ge=0, le=2**63 - 1)


__all__ = ["ProofOfWorkSubmission"]

