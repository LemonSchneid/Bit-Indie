import { CatalogGrid } from "../../components/catalog/catalog-grid";
import { listCatalogGames } from "../../lib/api";

export default async function GamesCatalogPage(): Promise<JSX.Element> {
  const games = await listCatalogGames();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Catalog</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Browse playable builds from the Bit Indie sandbox.
          </h1>
          <p className="max-w-3xl text-base text-slate-300">
            These listings load directly from the FastAPI backend. Seed the demo data to explore the full purchase flow for
            Starpath Siege, Chronorift Tactics, Lumen Forge, Echoes of the Deep, and Quantum Drift Rally using the Docker
            Compose bootstrap script.
          </p>
        </header>

        <CatalogGrid games={games} />
      </div>
    </main>
  );
}
