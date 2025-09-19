"""Pydantic schemas for zap receipt ingestion endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

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


class ZapSourceTotals(BaseModel):
    """Aggregated zap totals grouped by source classification."""

    source: str
    total_msats: int
    zap_count: int


class GameZapBreakdown(BaseModel):
    """Per-game zap totals with source breakdown for leaderboard displays."""

    game_id: str
    title: str
    slug: str
    total_msats: int
    zap_count: int
    source_totals: list[ZapSourceTotals] = Field(default_factory=list)


class GamesZapSummary(BaseModel):
    """Aggregated zap totals across all games and leading recipients."""

    total_msats: int
    zap_count: int
    source_totals: list[ZapSourceTotals] = Field(default_factory=list)
    top_games: list[GameZapBreakdown] = Field(default_factory=list)


class PlatformZapSummary(BaseModel):
    """Zap totals supporting the Proof of Play platform infrastructure."""

    total_msats: int
    zap_count: int
    source_totals: list[ZapSourceTotals] = Field(default_factory=list)
    lnurl: str | None


class ZapSummaryResponse(BaseModel):
    """Response payload describing zap momentum across the marketplace."""

    games: GamesZapSummary
    platform: PlatformZapSummary


__all__ = [
    "GameZapBreakdown",
    "GamesZapSummary",
    "PlatformZapSummary",
    "ZapRead",
    "ZapReceiptIngestRequest",
    "ZapReceiptResponse",
    "ZapSourceTotals",
    "ZapSummaryResponse",
]
