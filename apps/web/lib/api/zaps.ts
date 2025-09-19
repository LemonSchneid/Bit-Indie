import { requestJson } from "./core";

export type ZapSource = "DIRECT" | "FORWARDED";

export interface ZapSourceTotals {
  source: ZapSource;
  total_msats: number;
  zap_count: number;
}

export interface GameZapBreakdown {
  game_id: string;
  title: string;
  slug: string;
  total_msats: number;
  zap_count: number;
  source_totals: ZapSourceTotals[];
}

export interface GamesZapSummary {
  total_msats: number;
  zap_count: number;
  source_totals: ZapSourceTotals[];
  top_games: GameZapBreakdown[];
}

export interface PlatformZapSummary {
  total_msats: number;
  zap_count: number;
  source_totals: ZapSourceTotals[];
  lnurl: string | null;
}

export interface ZapSummary {
  games: GamesZapSummary;
  platform: PlatformZapSummary;
}

export async function getZapSummary(): Promise<ZapSummary> {
  return requestJson<ZapSummary>("/v1/zaps/summary", {
    cache: "no-store",
    errorMessage: "Unable to load zap summary.",
  });
}
