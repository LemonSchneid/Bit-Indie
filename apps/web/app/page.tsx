import Image from "next/image";

import { CatalogGrid } from "../components/catalog/catalog-grid";
import { listCatalogGames } from "../lib/api";

export default async function HomePage(): Promise<JSX.Element> {
  const games = await listCatalogGames();

  return (
    <main className="relative overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="absolute inset-y-0 right-0 -z-10 w-full max-w-3xl bg-[radial-gradient(circle_at_right,_rgba(59,130,246,0.12),_transparent_60%)]" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-16 px-6 py-16">
        <section className="space-y-6 text-center">
          <div className="flex justify-center">
            <Image
              src="/bit-indie-logo.svg"
              alt="Bit Indie logo"
              width={220}
              height={220}
              priority
              className="drop-shadow-[0_20px_45px_rgba(139,92,246,0.35)]"
            />
          </div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.55em] text-emerald-300/70">
            Bit Indie marketplace
          </p>
          <div className="space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Explore seeded builds and test the Lightning checkout flow.
            </h1>
            <p className="mx-auto max-w-2xl text-base text-slate-300">
              The catalog below loads directly from the FastAPI backend. Each listing is part of the Simple-MVP seed so you
              can exercise the full purchase pipeline, download gating, and review flow while we continue iterating.
            </p>
          </div>
        </section>

        <CatalogGrid games={games} />
      </div>
    </main>
  );
}
