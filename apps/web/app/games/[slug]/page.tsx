import Image from "next/image";
import { notFound } from "next/navigation";

import { GamePurchaseFlow } from "../../../components/game-purchase-flow";
import { ZapButton } from "../../../components/zap-button";
import {
  getGameBySlug,
  getGameReviews,
  type GameDraft,
  type GameReview,
} from "../../../lib/api";

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

function formatReviewDate(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently posted";
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatZapAmount(msats: number): string {
  if (!Number.isFinite(msats) || msats <= 0) {
    return "0 sats";
  }

  const sats = msats / 1000;
  if (Number.isInteger(sats)) {
    return `${Number(sats).toLocaleString()} sats`;
  }

  return `${Number(sats).toLocaleString(undefined, { maximumFractionDigits: 3 })} sats`;
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

function getReviewParagraphs(body: string): string[] {
  return body
    .split(/\r?\n\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

const BADGE_TONE_CLASSES = {
  emerald: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  amber: "border-amber-400/40 bg-amber-500/15 text-amber-100",
} as const;

type ReviewBadgeTone = keyof typeof BADGE_TONE_CLASSES;

type ReviewBadgeProps = {
  label: string;
  tooltip: string;
  tone: ReviewBadgeTone;
  icon?: string;
};

function ReviewBadge({ label, tooltip, tone, icon }: ReviewBadgeProps): JSX.Element {
  const toneClasses = BADGE_TONE_CLASSES[tone];

  return (
    <span
      className={`group relative inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${toneClasses}`}
      role="note"
      tabIndex={0}
    >
      {icon ? (
        <span aria-hidden className="text-sm leading-none">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
      <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden w-64 -translate-x-1/2 translate-y-2 rounded-xl border border-white/10 bg-slate-950/95 px-3 py-2 text-xs font-normal normal-case leading-relaxed text-slate-200 shadow-lg shadow-emerald-500/10 group-focus-visible:flex group-hover:flex">
        {tooltip}
      </span>
    </span>
  );
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
  let reviews: GameReview[] = [];
  let reviewsError: string | null = null;

  try {
    reviews = await getGameReviews(game.id);
  } catch (error) {
    if (error instanceof Error && error.message === "Reviews are not available for this game.") {
      reviews = [];
    } else {
      reviewsError =
        error instanceof Error
          ? error.message
          : "Unable to load community reviews right now.";
    }
  }

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
              <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                Tip the developer
              </h2>
              {game.developer_lightning_address ? (
                <>
                  <p className="mt-3 text-sm text-slate-300">
                    Lightning zaps go straight to the creator&apos;s wallet. Say thanks for the latest build or boost morale for
                    the next update.
                  </p>
                  <div className="mt-4">
                    <ZapButton
                      lightningAddress={game.developer_lightning_address}
                      recipientLabel={`${game.title} developer`}
                      comment={`Zap for ${game.title}`}
                    />
                  </div>
                  <p className="mt-4 text-[11px] text-slate-400">
                    Lightning address: {" "}
                    <span className="font-mono text-slate-300">{game.developer_lightning_address}</span>
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  The developer hasn&apos;t connected a Lightning address yet. Once they do, you&apos;ll be able to send sats
                  directly from here.
                </p>
              )}
            </div>

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

        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                Community reviews
              </h2>
              <p className="mt-2 text-xl font-semibold text-white">Zap-powered player feedback</p>
            </div>
            <p className="text-sm text-slate-400 sm:max-w-sm sm:text-right">
              Verified purchase badges confirm the reviewer bought the game. Zap totals reveal how many sats other players tipped
              their feedback.
            </p>
          </div>

          {reviewsError ? (
            <p className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-5 text-sm text-rose-100">
              {reviewsError}
            </p>
          ) : reviews.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
              No reviews yet. Share the download link to gather the first wave of community impressions.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {reviews.map((review) => {
                const paragraphs = getReviewParagraphs(review.body_md);
                const trimmedBody = review.body_md.trim();
                const displayParagraphs =
                  paragraphs.length > 0 ? paragraphs : trimmedBody ? [trimmedBody] : [];
                const zapLabel = formatZapAmount(review.total_zap_msats);
                const reviewerName = review.author.display_name || "the reviewer";
                const zapComment = `Zap for review ${review.id} on ${game.title}`;

                return (
                  <article
                    key={review.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-lg shadow-emerald-500/10"
                  >
                    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-3">
                        {review.title ? (
                          <h3 className="text-lg font-semibold text-white">{review.title}</h3>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                          {review.rating != null ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-amber-100">
                              <span aria-hidden className="text-base leading-none text-amber-300">
                                ★
                              </span>
                              <span className="font-semibold text-amber-100">{review.rating}/5</span>
                              <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/80">
                                Rating
                              </span>
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                              Comment only
                            </span>
                          )}
                          <time dateTime={review.created_at} className="text-slate-400">
                            {formatReviewDate(review.created_at)}
                          </time>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {review.is_verified_purchase ? (
                          <ReviewBadge
                            label="Verified Purchase"
                            icon="✓"
                            tone="emerald"
                            tooltip="This review comes from a player who paid for the build through Proof of Play."
                          />
                        ) : null}
                        <ReviewBadge
                          label={`Received ${zapLabel}`}
                          icon="⚡"
                          tone="amber"
                          tooltip="Lightning zaps tipped to this review. More sats signal that players found it especially helpful."
                        />
                        <ZapButton
                          lightningAddress={review.author.lightning_address}
                          recipientLabel={reviewerName}
                          comment={zapComment}
                          className="inline-block"
                        />
                      </div>
                    </header>
                    <div className="mt-4 space-y-3 text-base leading-7 text-slate-200">
                      {displayParagraphs.map((paragraph, index) => (
                        <p key={`${review.id}-paragraph-${index}`}>{paragraph}</p>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
