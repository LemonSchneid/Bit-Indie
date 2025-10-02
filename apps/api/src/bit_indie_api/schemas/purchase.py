"""Pydantic models for purchase creation, status checks, and webhooks."""

from __future__ import annotations

from datetime import datetime

from pydantic import AnyUrl, BaseModel, ConfigDict, Field, model_validator

from bit_indie_api.db.models import InvoiceStatus, PayoutStatus, RefundStatus


class InvoiceCreateRequest(BaseModel):
    """Request payload used when asking for a Lightning invoice."""

    user_id: str | None = Field(None, min_length=1)
    anon_id: str | None = Field(None, min_length=1, max_length=120)

    @model_validator(mode="after")
    def validate_actor(self) -> "InvoiceCreateRequest":
        """Ensure either ``user_id`` or ``anon_id`` is provided, but not both."""

        has_user = bool(self.user_id)
        has_anon = bool(self.anon_id)
        if has_user == has_anon:
            msg = "Provide either user_id or anon_id for invoice creation."
            raise ValueError(msg)
        return self


class InvoiceCreateResponse(BaseModel):
    """Response returned after creating a purchase invoice."""

    purchase_id: str
    user_id: str
    invoice_id: str
    payment_request: str
    amount_msats: int
    invoice_status: InvoiceStatus
    check_url: AnyUrl
    hosted_checkout_url: AnyUrl | None = None


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
    refund_requested: bool
    refund_status: RefundStatus
    developer_payout_status: PayoutStatus
    developer_payout_reference: str | None
    developer_payout_error: str | None
    platform_payout_status: PayoutStatus
    platform_payout_reference: str | None
    platform_payout_error: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OpenNodeWebhookPayload(BaseModel):
    """Incoming payload from the OpenNode webhook integration."""

    id: str = Field(..., min_length=1, max_length=120)
    status: str | None = Field(default=None, max_length=50)


class PurchaseDownloadRequest(BaseModel):
    """Request payload for generating a signed download link."""

    user_id: str = Field(..., min_length=1)


class PurchaseDownloadResponse(BaseModel):
    """Response payload describing a signed download link."""

    download_url: AnyUrl
    expires_at: datetime


class PurchaseReceiptGame(BaseModel):
    """Summary details about the purchased game for receipt displays."""

    id: str
    title: str
    slug: str
    cover_url: str | None
    receipt_thumbnail_url: str | None
    price_msats: int | None
    build_available: bool


class PurchaseReceiptBuyer(BaseModel):
    """Minimal representation of the buyer shown on receipts."""

    id: str
    account_identifier: str
    display_name: str | None

    model_config = ConfigDict(from_attributes=True)


class PurchaseReceipt(BaseModel):
    """Full payload for rendering a purchase receipt."""

    purchase: PurchaseRead
    game: PurchaseReceiptGame
    buyer: PurchaseReceiptBuyer


class PurchaseRefundRequest(BaseModel):
    """Request body for a buyer initiated refund request."""

    user_id: str = Field(..., min_length=1)


class RefundPayoutCreate(BaseModel):
    """Request payload used when an admin records a refund payout."""

    user_id: str = Field(..., min_length=1)
    amount_msats: int | None = Field(None, ge=0)
    payment_reference: str | None = Field(None, max_length=255)
    notes: str | None = Field(None, max_length=2000)


class RefundPayoutRead(BaseModel):
    """Serialized representation of a recorded refund payout."""

    id: str
    purchase_id: str
    processed_by_id: str | None
    amount_msats: int | None
    payment_reference: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RefundPayoutResponse(BaseModel):
    """Response returned after successfully recording a refund payout."""

    purchase: PurchaseRead
    payout: RefundPayoutRead


__all__ = [
    "InvoiceCreateRequest",
    "InvoiceCreateResponse",
    "OpenNodeWebhookPayload",
    "PurchaseDownloadRequest",
    "PurchaseDownloadResponse",
    "PurchaseRead",
    "PurchaseReceipt",
    "PurchaseReceiptBuyer",
    "PurchaseReceiptGame",
    "PurchaseRefundRequest",
    "RefundPayoutCreate",
    "RefundPayoutRead",
    "RefundPayoutResponse",
]
