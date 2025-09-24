import NeonLanding from "../components/landing/neon-landing";
import { getFeaturedGames, listCatalogGames } from "../lib/api";
import type { FeaturedGameSummary, GameDraft } from "../lib/api/games";

async function safeLoadCatalog(): Promise<GameDraft[]> {
  try {
    return await listCatalogGames();
  } catch (error) {
    console.error("Failed to load catalog games", error);
    return [];
  }
}

async function safeLoadFeatured(): Promise<FeaturedGameSummary[]> {
  try {
    return await getFeaturedGames(6);
  } catch (error) {
    console.error("Failed to load featured games", error);
    return [];
  }
}

export default async function HomePage(): Promise<JSX.Element> {
  const [catalogGames, featuredSummaries] = await Promise.all([safeLoadCatalog(), safeLoadFeatured()]);

  return <NeonLanding catalogGames={catalogGames} featuredSummaries={featuredSummaries} />;
}
