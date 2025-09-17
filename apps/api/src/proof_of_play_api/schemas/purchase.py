"""Pydantic models for purchase creation, status checks, and webhooks."""

from __future__ import annotations

from datetime import datetime

from pydantic import AnyUrl, BaseModel, ConfigDict, Field

from proof_of_play_api.db.models import InvoiceStatus


class InvoiceCreateRequest(BaseModel):
    """Request payload used when asking for a Lightning invoice."""

    user_id: str = Field(..., min_length=1)


class InvoiceCreateResponse(BaseModel):
    """Response returned after creating a purchase invoice."""

    purchase_id: str
    invoice_id: str
    payment_request: str
    amount_msats: int
    invoice_status: InvoiceStatus
    check_url: AnyUrl


class PurchaseRead(BaseModel):
    """Serialized representation of a purchase record."""

    id: str
    user_id: str
    game_id: str
    invoice_id: str
    invoice_status: InvoiceStatus
    amount_msats: int | None
    paid_at: datetime | None
    download_granted: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LnBitsWebhookPayload(BaseModel):
    """Incoming payload from the LNbits webhook integration."""

    payment_hash: str = Field(..., min_length=1, max_length=120)


class PurchaseDownloadRequest(BaseModel):
    """Request payload for generating a signed download link."""

    user_id: str = Field(..., min_length=1)


class PurchaseDownloadResponse(BaseModel):
    """Response payload describing a signed download link."""

    download_url: AnyUrl
    expires_at: datetime


__all__ = [
    "InvoiceCreateRequest",
    "InvoiceCreateResponse",
    "LnBitsWebhookPayload",
    "PurchaseDownloadRequest",
    "PurchaseDownloadResponse",
    "PurchaseRead",
]
