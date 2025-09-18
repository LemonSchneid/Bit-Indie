"""Pydantic models for administrative integrity statistics."""

from pydantic import BaseModel, Field


class AdminIntegrityStats(BaseModel):
    """Aggregated operational metrics for administrators."""

    refund_rate: float = Field(
        ...,
        description="Proportion of paid purchases that were refunded.",
        ge=0.0,
    )
    refunded_purchase_count: int = Field(
        ...,
        description="Number of purchases that have been refunded.",
        ge=0,
    )
    paid_purchase_count: int = Field(
        ...,
        description="Total number of purchases that reached a paid state.",
        ge=0,
    )
    total_refund_payout_msats: int = Field(
        ...,
        description="Sum of manual refund payouts recorded in millisatoshis.",
        ge=0,
    )
    takedown_rate: float = Field(
        ...,
        description="Proportion of moderation flags resolved via takedowns.",
        ge=0.0,
    )
    actioned_flag_count: int = Field(
        ...,
        description="Count of moderation flags that resulted in takedowns.",
        ge=0,
    )
    dismissed_flag_count: int = Field(
        ...,
        description="Count of moderation flags that moderators dismissed.",
        ge=0,
    )
    open_flag_count: int = Field(
        ...,
        description="Number of moderation flags that remain unresolved.",
        ge=0,
    )
    total_flag_count: int = Field(
        ...,
        description="Total moderation flags submitted by the community.",
        ge=0,
    )
    handled_flag_count: int = Field(
        ...,
        description="Number of moderation flags that received moderator attention.",
        ge=0,
    )
    estimated_moderation_hours: float = Field(
        ...,
        description="Approximate moderator effort derived from handled flags.",
        ge=0.0,
    )


__all__ = ["AdminIntegrityStats"]
