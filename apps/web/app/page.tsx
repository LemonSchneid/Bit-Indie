import NeonLanding from "../components/landing/neon-landing";
import { getFeaturedGames, listCatalogGames } from "../lib/api";
import type { FeaturedGameSummary, GameDraft } from "../lib/api/games";
import { recordLandingDataLoadFailure } from "../lib/telemetry";

type CatalogLoadResult = {
  games: GameDraft[];
  failed: boolean;
};

type FeaturedLoadResult = {
  summaries: FeaturedGameSummary[];
  failed: boolean;
};

async function loadCatalog(): Promise<CatalogLoadResult> {
  try {
    const games = await listCatalogGames();
    return { games, failed: false };
  } catch (error) {
    console.error("Failed to load catalog games", error);
    recordLandingDataLoadFailure("catalog", error);
    return { games: [], failed: true };
  }
}

async function loadFeatured(): Promise<FeaturedLoadResult> {
  try {
    const summaries = await getFeaturedGames(6);
    return { summaries, failed: false };
  } catch (error) {
    console.error("Failed to load featured games", error);
    recordLandingDataLoadFailure("featured", error);
    return { summaries: [], failed: true };
  }
}

export default async function HomePage(): Promise<JSX.Element> {
  const [{ games: catalogGames, failed: catalogFailed }, { summaries: featuredSummaries, failed: featuredFailed }] =
    await Promise.all([loadCatalog(), loadFeatured()]);

  const hadLoadFailure = catalogFailed || featuredFailed;

  return (
    <NeonLanding
      catalogGames={catalogGames}
      featuredSummaries={featuredSummaries}
      hadLoadFailure={hadLoadFailure}
    />
  );
}
