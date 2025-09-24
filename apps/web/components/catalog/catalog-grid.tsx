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
      <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-slate-300">
        <h2 className="text-xl font-semibold text-white">No games available yet</h2>
        <p className="mt-3 text-sm text-slate-300">
          Start the Docker Compose stack and run the seed script to populate the sandbox catalog.
        </p>
        <code className="mt-4 block rounded-xl border border-emerald-400/40 bg-slate-950 px-4 py-3 text-xs text-emerald-200">
          docker compose -f infra/docker-compose.yml exec api python -m bit_indie_api.scripts.seed_simple_mvp
        </code>
      </section>
    );
  }

  return (
    <section className="grid gap-6 sm:grid-cols-2">
      {games.map((game) => (
        <article
          key={game.id}
          className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-lg shadow-emerald-500/10"
        >
          <div className="relative h-48 w-full bg-slate-900/80">
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
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Cover art coming soon</div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-5 p-6">
            <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
              <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">{formatStatus(game.status)}</span>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                {formatCategory(game.category)}
              </span>
              <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-slate-300">
                Updated {formatDateLabel(game.updated_at, { fallback: "recently" })}
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                <Link
                  href={`/games/${game.slug}`}
                  className="transition hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                >
                  {game.title}
                </Link>
              </h2>
              {game.summary ? (
                <p className="text-sm text-slate-300">{game.summary}</p>
              ) : (
                <p className="text-sm text-slate-400">Summary coming soon from the developer.</p>
              )}
            </div>

            <div className="mt-auto space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-white">
                  {formatPriceMsats(game.price_msats)}
                </span>
                <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  {game.developer_lightning_address ? `⚡ ${game.developer_lightning_address}` : "Lightning address pending"}
                </span>
              </div>

              <Link
                href={`/games/${game.slug}`}
                className="inline-flex items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
              >
                View details & checkout
              </Link>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
