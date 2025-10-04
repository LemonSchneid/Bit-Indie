import { CatalogGrid } from "../../components/catalog/catalog-grid";
import { MatteShell } from "../../components/layout/matte-shell";
import { listCatalogGames } from "../../lib/api";

export default async function GamesCatalogPage(): Promise<JSX.Element> {
  const games = await listCatalogGames();

  return (
    <MatteShell>
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.35em] text-[#7bffc8]/80">Catalog</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Discover Indie Games</h1>
        <p className="max-w-3xl text-base text-[#b8ffe5]/70">Explore unique titles and playable builds. When you find something you like, purchase instantly with Bitcoin over the Lightning Network.</p>
      </header>

      <CatalogGrid games={games} />
    </MatteShell>
  );
}
