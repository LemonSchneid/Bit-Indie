import Image from "next/image";
import { notFound } from "next/navigation";

import { GamePurchaseFlow } from "../../../components/game-purchase-flow";
import { ZapButton } from "../../../components/zap-button";
import {
  getGameBySlug,
  getGameComments,
  getGameReviews,
  type GameComment,
  type GameDraft,
  type GameReview,
} from "../../../lib/api";
import {
  formatCategory,
  formatDateLabel,
  formatPriceMsats,
  formatStatus,
  formatZapAmount,
} from "../../../lib/format";
import { nostrEnabled } from "../../../lib/flags";

type GamePageProps = {
  params: {
    slug: string;
  };
};

function formatNpub(value: string | null): string {
  if (!value) {
    return "npub unknown";
  }

  const trimmed = value.trim();
  if (trimmed.length <= 16) {
    return trimmed;
  }

  return `${trimmed.slice(0, 10)}…${trimmed.slice(-6)}`;
}

function formatPubkeyHex(value: string | null): string {
  if (!value) {
    return "unknown";
  }

  const trimmed = value.trim();
  if (trimmed.length <= 12) {
    return trimmed;
  }

  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
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

function getCommentParagraphs(body: string): string[] {
  return body
    .split(/\r?\n\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function getCommentAuthorLabel(comment: GameComment): string {
  const displayName = comment.author.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  const npubLabel = comment.author.npub;
  if (npubLabel) {
    return formatNpub(npubLabel);
  }

  return formatPubkeyHex(comment.author.pubkey_hex);
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
  const updatedLabel = formatDateLabel(game.updated_at, { fallback: "Recently updated" });
  const hasPaidPrice = game.price_msats != null && game.price_msats > 0;
  const buildAvailable = Boolean(game.build_object_key);
  const checkoutAvailable = hasPaidPrice && game.active;
  let comments: GameComment[] = [];
  let commentsError: string | null = null;
  let reviews: GameReview[] = [];
  let reviewsError: string | null = null;

  try {
    comments = await getGameComments(game.id);
  } catch (error) {
    if (error instanceof Error && error.message === "Comments are not available for this game.") {
      comments = [];
    } else {
      commentsError =
        error instanceof Error
          ? error.message
          : "Unable to load community comments right now.";
    }
  }

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
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />
      <div className="absolute inset-y-0 right-0 -z-20 w-full max-w-4xl bg-[radial-gradient(circle_at_right,_rgba(59,130,246,0.12),_transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-20 h-72 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.18),_transparent_65%)]" />
      <div className="absolute left-1/2 top-24 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-xl shadow-emerald-500/10">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_65%)]" />
          <div className="absolute -right-32 top-1/2 -z-10 h-80 w-80 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.18),_transparent_70%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[3fr_2fr]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                <span className="rounded-full border border-white/10 bg-slate-900/50 px-4 py-1">
                  {formatStatus(game.status)}
                </span>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-1 text-emerald-200">
                  {formatCategory(game.category)}
                </span>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {game.title}
              </h1>
              {game.summary ? (
                <p className="max-w-2xl text-lg text-slate-200">{game.summary}</p>
              ) : (
                <p className="max-w-2xl text-lg text-slate-400">
                  This game is still being prepared for its public launch.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 shadow shadow-emerald-500/10">
                  {priceLabel}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                  Updated {updatedLabel}
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-lg shadow-emerald-500/10">
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
                <div className="flex h-full min-h-[300px] items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-500">
                  Cover art coming soon
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[3fr_2fr]">
          <article className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-base leading-7 text-slate-300 shadow-lg shadow-emerald-500/10">
            {descriptionParagraphs.length > 0 ? (
              descriptionParagraphs.map((paragraph) => (
                <p key={paragraph} className="text-slate-200">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-white/20 bg-slate-950/60 p-6 text-slate-400">
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
                  developerLightningAddress={game.developer_lightning_address}
                />
              ) : (
                <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300 shadow-lg shadow-emerald-500/10">
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
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300 shadow-lg shadow-emerald-500/10">
                <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Free download</h2>
                <p className="mt-3 text-sm text-slate-300">
                  This build will be shared for free once the developer uploads the files. Check back soon for the download
                  link.
                </p>
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300 shadow-lg shadow-emerald-500/10">
              <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                Tip the developer
              </h2>
              <p className="mt-3 text-sm text-slate-300">
                Lightning zaps go straight to the creator&apos;s wallet. Say thanks for the latest build or boost morale for the next
                update.
              </p>
              <div className="mt-4">
                <ZapButton recipientLabel={`${game.title} developer`} comment={`Zap for ${game.title}`} />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300 shadow-lg shadow-emerald-500/10">
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

        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-lg shadow-emerald-500/10">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_60%)]" />
          <div className="absolute -right-24 bottom-0 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.15),_transparent_70%)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                Community thread
              </h2>
              <p className="mt-2 text-xl font-semibold text-white">
                {nostrEnabled ? "Comments from Bit Indie and Nostr" : "Comments from Bit Indie"}
              </p>
            </div>
            <p className="text-sm text-slate-400 sm:max-w-sm sm:text-right">
              {nostrEnabled
                ? "First-party comments appear alongside replies to the release note on public relays. Verified purchase badges highlight players who bought the build."
                : "First-party comments from Bit Indie are shown here. Verified purchase badges highlight players who bought the build."}
            </p>
          </div>

          {commentsError ? (
            <p className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-5 text-sm text-rose-100">
              {commentsError}
            </p>
          ) : (nostrEnabled ? comments : comments.filter((c) => c.source === "FIRST_PARTY")).length === 0 ? (
            <p className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
              No comments yet. Share the release note or invite players to leave feedback here.
            </p>
          ) : (
            <div className="relative z-10 mt-6 space-y-6">
              {(nostrEnabled ? comments : comments.filter((c) => c.source === "FIRST_PARTY")).map((comment) => {
                const paragraphs = getCommentParagraphs(comment.body_md);
                const trimmedBody = comment.body_md.trim();
                const displayParagraphs =
                  paragraphs.length > 0 ? paragraphs : trimmedBody ? [trimmedBody] : [];
                const authorLabel = getCommentAuthorLabel(comment);
                const authorTitle = comment.author.npub ?? comment.author.pubkey_hex ?? undefined;
                const isNostrReply = nostrEnabled && comment.source === "NOSTR";
                const zapLabel = formatZapAmount(comment.total_zap_msats);
                const zapRecipient = authorLabel || "this commenter";
                const zapComment = `Zap for comment ${comment.id} on ${game.title}`;

                return (
                  <article
                    key={comment.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-lg shadow-emerald-500/10"
                  >
                    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <p className="font-semibold text-white" title={authorTitle}>
                          {authorLabel}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                          <time dateTime={comment.created_at} className="text-slate-400">
                            {formatDateLabel(comment.created_at, { fallback: "Just now" })}
                          </time>
                          {isNostrReply ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-violet-200">
                              Nostr reply
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                              Bit Indie
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {comment.is_verified_purchase ? (
                          <ReviewBadge
                            label="Verified Purchase"
                            icon="✓"
                            tone="emerald"
                            tooltip="This commenter purchased the build through Bit Indie."
                          />
                        ) : null}
                        {comment.total_zap_msats > 0 ? (
                          <ReviewBadge
                            label={`Received ${zapLabel}`}
                            tone="amber"
                            tooltip="Lightning zaps tipped to this comment."
                            icon="⚡"
                          />
                        ) : null}
                        <ZapButton recipientLabel={zapRecipient} comment={zapComment} className="mt-2 sm:mt-0" />
                      </div>
                    </header>
                    <div className="mt-4 space-y-3 text-base leading-7 text-slate-200">
                      {displayParagraphs.map((paragraph, index) => (
                        <p key={`${comment.id}-paragraph-${index}`}>{paragraph}</p>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-lg shadow-emerald-500/10">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_60%)]" />
          <div className="absolute -left-24 bottom-0 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.15),_transparent_70%)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
                            {formatDateLabel(review.created_at, { fallback: "Recently posted" })}
                          </time>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {review.is_verified_purchase ? (
                          <ReviewBadge
                            label="Verified Purchase"
                            icon="✓"
                            tone="emerald"
                            tooltip="This review comes from a player who paid for the build through Bit Indie."
                          />
                        ) : null}
                        <ReviewBadge
                          label={`Received ${zapLabel}`}
                          icon="⚡"
                          tone="amber"
                          tooltip="Lightning zaps tipped to this review. More sats signal that players found it especially helpful."
                        />
                        <ZapButton recipientLabel={reviewerName} comment={zapComment} className="inline-block" />
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
