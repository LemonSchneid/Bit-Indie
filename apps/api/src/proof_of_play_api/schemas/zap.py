"""Pydantic schemas for zap receipt ingestion endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from proof_of_play_api.schemas.auth import NostrEvent
from proof_of_play_api.schemas.review import ReviewRead


class ZapRead(BaseModel):
    """Serialized representation of a stored zap receipt."""

    id: str
    target_type: str
    target_id: str
    from_pubkey: str
    to_pubkey: str
    amount_msats: int
    event_id: str
    received_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ZapReceiptIngestRequest(BaseModel):
    """Request payload describing a zap receipt event pushed from a relay."""

    event: NostrEvent


class ZapReceiptResponse(BaseModel):
    """Response payload containing the stored zap and updated review."""

    zap: ZapRead
    review: ReviewRead


__all__ = ["ZapRead", "ZapReceiptIngestRequest", "ZapReceiptResponse"]
