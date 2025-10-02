import Image from "next/image";
import Link from "next/link";

import type { GameDraft } from "../../lib/api";
import { formatCategory, formatDateLabel, formatPriceMsats, formatStatus } from "../../lib/format";

type CatalogGridProps = {
  games: GameDraft[];
};

export function CatalogGrid({ games }: CatalogGridProps): JSX.Element {
  if (games.length === 0) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-[#060606]/90 p-8 text-[#dcfff2]/80 shadow-[0_0_45px_rgba(123,255,200,0.12)] backdrop-blur-xl before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-[#7bffc8]/20 before:opacity-60 before:content-['']">
        <h2 className="text-xl font-semibold text-white">No games available yet</h2>
        <p className="mt-3 text-sm text-[#dcfff2]/75">
          Start the Docker Compose stack and run the seed script to populate the sandbox catalog.
        </p>
        <code className="mt-4 block rounded-xl border border-[#7bffc8]/50 bg-[#050505] px-4 py-3 text-xs text-[#7bffc8]">
          docker compose -f infra/docker-compose.yml exec api python -m bit_indie_api.scripts.seed_simple_mvp
        </code>
      </section>
    );
  }

  return (
    <section className="grid gap-6 sm:grid-cols-2">
      {games.map((game) => (
        <Link
          key={game.id}
          href={`/games/${game.slug}`}
          className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-emerald-500/20 bg-[#060606]/90 shadow-[0_0_45px_rgba(123,255,200,0.12)] backdrop-blur-xl transition hover:border-[#7bffc8]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7bffc8]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] before:pointer-events-none before:absolute before:-inset-px before:rounded-[1.45rem] before:border before:border-[#7bffc8]/20 before:opacity-60 before:transition before:content-[''] hover:before:border-[#7bffc8]/40"
        >
          <div className="relative h-48 w-full bg-[#0b0b0b]">
            {game.cover_url ? (
              <Image
                src={game.cover_url}
                alt={`${game.title} cover art`}
                fill
                className="object-cover"
                sizes="(min-width: 768px) 50vw, 100vw"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[#7bffc8]/60">Cover art coming soon</div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-5 p-6">
            <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#7bffc8]/70">
              <span className="rounded-full border border-white/15 bg-[#050505]/90 px-3 py-1 text-white">{formatStatus(game.status)}</span>
              <span className="rounded-full border border-[#7bffc8]/50 bg-[#7bffc8]/20 px-3 py-1 text-[#f3fff9]">
                {formatCategory(game.category)}
              </span>
              <span className="rounded-full border border-white/10 bg-[#050505]/90 px-3 py-1 text-[#dcfff2]/75">
                Updated {formatDateLabel(game.updated_at, { fallback: "recently" })}
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-white transition group-hover:text-[#7bffc8] group-focus-visible:text-[#7bffc8]">
                {game.title}
              </h2>
              {game.summary ? (
                <p className="text-sm text-[#dcfff2]/80">{game.summary}</p>
              ) : (
                <p className="text-sm text-[#b8ffe5]/70">Summary coming soon from the developer.</p>
              )}
            </div>

            <div className="mt-auto space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-[#dcfff2]/80">
                <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-white">
                  {formatPriceMsats(game.price_msats)}
                </span>
                <span className="text-xs uppercase tracking-[0.3em] text-[#b8ffe5]/60">
                  {game.developer_lightning_address ? `⚡ ${game.developer_lightning_address}` : "Lightning address pending"}
                </span>
              </div>

              <span className="inline-flex items-center justify-center rounded-xl border border-[#7bffc8]/60 bg-[#7bffc8]/15 px-4 py-2 text-sm font-semibold text-white transition group-hover:border-[#7bffc8] group-hover:text-[#050505] group-hover:bg-[#7bffc8]/90 group-focus-visible:border-[#7bffc8] group-focus-visible:text-[#050505] group-focus-visible:bg-[#7bffc8]/90">
                View details & checkout
              </span>
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}
