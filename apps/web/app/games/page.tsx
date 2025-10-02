import { CatalogGrid } from "../../components/catalog/catalog-grid";
import { MatteShell } from "../../components/layout/matte-shell";
import { listCatalogGames } from "../../lib/api";

export default async function GamesCatalogPage(): Promise<JSX.Element> {
  const games = await listCatalogGames();

  return (
    <MatteShell>
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.35em] text-[#7bffc8]/80">Catalog</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Browse playable builds from the Bit Indie sandbox.
        </h1>
        <p className="max-w-3xl text-base text-[#b8ffe5]/70">
          These listings load directly from the FastAPI backend. Seed the demo data to explore the full purchase flow for
          Starpath Siege, Chronorift Tactics, Lumen Forge, Echoes of the Deep, and Quantum Drift Rally using the Docker
          Compose bootstrap script.
        </p>
      </header>

      <CatalogGrid games={games} />
    </MatteShell>
  );
}
