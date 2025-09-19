"""API routes exposing aggregated Lightning zap ledger information."""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from proof_of_play_api.core.config import get_nostr_publisher_settings
from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import Game, ZapLedgerTotal, ZapSource, ZapTargetType
from proof_of_play_api.schemas.zap import (
    GameZapBreakdown,
    GamesZapSummary,
    PlatformZapSummary,
    ZapSourceTotals,
    ZapSummaryResponse,
)

router = APIRouter(prefix="/v1/zaps", tags=["zaps"])

_TOP_GAME_LIMIT = 3


def _build_source_totals(source_map: dict[ZapSource, dict[str, int]]) -> list[ZapSourceTotals]:
    """Convert accumulated source totals into response models."""

    items = []
    for source, values in sorted(source_map.items(), key=lambda item: item[0].value):
        items.append(
            ZapSourceTotals(
                source=source.value,
                total_msats=values.get("total_msats", 0),
                zap_count=values.get("zap_count", 0),
            )
        )
    return items


@router.get(
    "/summary",
    response_model=ZapSummaryResponse,
    summary="Retrieve aggregated zap totals across games and platform",
)
def read_zap_summary(session: Session = Depends(get_session)) -> ZapSummaryResponse:
    """Return marketplace-wide zap momentum metrics for dashboards."""

    rows = session.execute(
        select(
            ZapLedgerTotal.target_type,
            ZapLedgerTotal.target_id,
            ZapLedgerTotal.zap_source,
            ZapLedgerTotal.total_msats,
            ZapLedgerTotal.zap_count,
        )
    ).all()

    game_totals: dict[str, dict[str, object]] = {}
    game_source_totals: dict[ZapSource, dict[str, int]] = defaultdict(lambda: {"total_msats": 0, "zap_count": 0})
    platform_source_totals: dict[ZapSource, dict[str, int]] = defaultdict(lambda: {"total_msats": 0, "zap_count": 0})

    for row in rows:
        amount = int(row.total_msats or 0)
        count = int(row.zap_count or 0)
        source = row.zap_source

        if row.target_type == ZapTargetType.GAME:
            game_entry = game_totals.setdefault(
                row.target_id,
                {
                    "total_msats": 0,
                    "zap_count": 0,
                    "sources": defaultdict(lambda: {"total_msats": 0, "zap_count": 0}),
                },
            )
            game_entry["total_msats"] = int(game_entry["total_msats"]) + amount
            game_entry["zap_count"] = int(game_entry["zap_count"]) + count
            source_map = game_entry["sources"]
            source_totals = source_map[source]
            source_totals["total_msats"] += amount
            source_totals["zap_count"] += count

            aggregate_source = game_source_totals[source]
            aggregate_source["total_msats"] += amount
            aggregate_source["zap_count"] += count
        elif row.target_type == ZapTargetType.PLATFORM:
            platform_totals = platform_source_totals[source]
            platform_totals["total_msats"] += amount
            platform_totals["zap_count"] += count

    # Build top games ordered by total sats received.
    sorted_game_ids = sorted(
        game_totals,
        key=lambda game_id: int(game_totals[game_id]["total_msats"]),
        reverse=True,
    )
    top_game_ids = sorted_game_ids[:_TOP_GAME_LIMIT]

    games_metadata: dict[str, dict[str, str]] = {}
    if top_game_ids:
        metadata_rows = session.execute(
            select(Game.id, Game.title, Game.slug).where(Game.id.in_(top_game_ids))
        ).all()
        games_metadata = {
            row.id: {"title": row.title or "Unknown Game", "slug": row.slug or ""}
            for row in metadata_rows
        }

    top_games: list[GameZapBreakdown] = []
    for game_id in top_game_ids:
        totals = game_totals[game_id]
        metadata = games_metadata.get(game_id)
        title = metadata.get("title") if metadata is not None else "Unknown Game"
        slug = metadata.get("slug") if metadata is not None else ""
        source_map = totals["sources"]
        source_breakdown = _build_source_totals(source_map)
        top_games.append(
            GameZapBreakdown(
                game_id=game_id,
                title=title,
                slug=slug,
                total_msats=int(totals["total_msats"]),
                zap_count=int(totals["zap_count"]),
                source_totals=source_breakdown,
            )
        )

    total_game_msats = sum(int(entry["total_msats"]) for entry in game_totals.values())
    total_game_count = sum(int(entry["zap_count"]) for entry in game_totals.values())
    games_summary = GamesZapSummary(
        total_msats=total_game_msats,
        zap_count=total_game_count,
        source_totals=_build_source_totals(game_source_totals),
        top_games=top_games,
    )

    total_platform_msats = sum(values["total_msats"] for values in platform_source_totals.values())
    total_platform_count = sum(values["zap_count"] for values in platform_source_totals.values())
    platform_summary = PlatformZapSummary(
        total_msats=total_platform_msats,
        zap_count=total_platform_count,
        source_totals=_build_source_totals(platform_source_totals),
        lnurl=get_nostr_publisher_settings().platform_lnurl,
    )

    return ZapSummaryResponse(games=games_summary, platform=platform_summary)


__all__ = ["read_zap_summary"]
