import Image from "next/image";
import { notFound } from "next/navigation";

import type { GameDraft } from "../../../lib/api";
import { getGameBySlug } from "../../../lib/api";
import { GamePurchaseFlow } from "../../../components/game-purchase-flow";

type GamePageProps = {
  params: {
    slug: string;
  };
};

function formatPriceMsats(value: number | null): string {
  if (value === null) {
    return "Free download";
  }

  const sats = value / 1000;
  if (Number.isInteger(sats)) {
    return `${Number(sats).toLocaleString()} sats`;
  }

  return `${Number(sats).toLocaleString(undefined, { maximumFractionDigits: 3 })} sats`;
}

function formatCategory(category: GameDraft["category"]): string {
  switch (category) {
    case "PROTOTYPE":
      return "Prototype";
    case "EARLY_ACCESS":
      return "Early Access";
    case "FINISHED":
      return "Finished";
    default:
      return category.replaceAll("_", " ").toLowerCase();
  }
}

function formatStatus(status: GameDraft["status"]): string {
  switch (status) {
    case "UNLISTED":
      return "Unlisted preview";
    case "DISCOVER":
      return "Discover";
    case "FEATURED":
      return "Featured";
    default:
      return status;
  }
}

function formatUpdatedAt(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently updated";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDescriptionParagraphs(description: string | null): string[] {
  if (!description) {
    return [];
  }

  return description
    .split(/\r?\n\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export default async function GameDetailPage({ params }: GamePageProps) {
  let game: GameDraft;
  try {
    game = await getGameBySlug(params.slug);
  } catch (error) {
    if (error instanceof Error && error.message === "Game not found.") {
      notFound();
    }

    throw error;
  }

  const descriptionParagraphs = getDescriptionParagraphs(game.description_md);
  const priceLabel = formatPriceMsats(game.price_msats);
  const updatedLabel = formatUpdatedAt(game.updated_at);
  const hasPaidPrice = game.price_msats != null && game.price_msats > 0;
  const buildAvailable = Boolean(game.build_object_key);
  const checkoutAvailable = hasPaidPrice && game.active;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16">
        <section className="grid gap-8 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
              <span className="rounded-full border border-white/10 bg-slate-900/50 px-4 py-1">
                {formatStatus(game.status)}
              </span>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1 text-emerald-200">
                {formatCategory(game.category)}
              </span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {game.title}
            </h1>
            {game.summary ? (
              <p className="max-w-2xl text-lg text-slate-300">{game.summary}</p>
            ) : (
              <p className="max-w-2xl text-lg text-slate-400">
                This game is still being prepared for its public launch.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white">
                {priceLabel}
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-slate-300">
                Updated {updatedLabel}
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-lg shadow-emerald-500/10">
            {game.cover_url ? (
              <Image
                src={game.cover_url}
                alt={`${game.title} cover art`}
                width={1280}
                height={720}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-slate-500">
                Cover art coming soon
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[3fr_2fr]">
          <article className="space-y-5 text-base leading-7 text-slate-300">
            {descriptionParagraphs.length > 0 ? (
              descriptionParagraphs.map((paragraph) => (
                <p key={paragraph} className="text-slate-200">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-slate-400">
                The developer hasn&apos;t shared a full description yet. Check back soon for gameplay details and download
                instructions.
              </p>
            )}
          </article>

          <aside className="space-y-5">
            {hasPaidPrice ? (
              checkoutAvailable ? (
                <GamePurchaseFlow
                  gameId={game.id}
                  gameTitle={game.title}
                  priceMsats={game.price_msats}
                  priceLabel={priceLabel}
                  buildAvailable={buildAvailable}
                />
              ) : (
                <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                    Checkout locked
                  </h2>
                  <p className="mt-3 text-sm text-slate-300">
                    Lightning checkout opens once this listing is published. The developer can finish their launch checklist
                    to make purchases available.
                  </p>
                </div>
              )
            ) : (
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
                <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Free download</h2>
                <p className="mt-3 text-sm text-slate-300">
                  This build will be shared for free once the developer uploads the files. Check back soon for the download
                  link.
                </p>
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
              <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Release status</h2>
              <p>
                Unlisted games are ready for direct sharing. Developers can finalize their launch checklist to move into the
                public catalog.
              </p>
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-200">
                <p className="text-xs font-semibold uppercase tracking-[0.3em]">Visibility</p>
                <p className="mt-1 text-sm">
                  Share this link with playtesters to gather feedback before promoting the game to the Discover feed.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
