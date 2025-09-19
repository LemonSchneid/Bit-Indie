import { buildApiUrl, parseErrorMessage } from "./core";

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
  const response = await fetch(buildApiUrl("/v1/zaps/summary"), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response, "Unable to load zap summary.");
    throw new Error(message);
  }

  return (await response.json()) as ZapSummary;
}
