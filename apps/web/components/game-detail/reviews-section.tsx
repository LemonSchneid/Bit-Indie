import { type GameReview } from "../../lib/api";
import { formatDateLabel } from "../../lib/format";

import { ReviewBadge } from "./review-badge";
import { getReviewParagraphs } from "./utils";
import { FlagContentButton } from "./flag-content-button";

type GameReviewsSectionProps = {
  gameTitle: string;
  reviews: GameReview[];
  reviewsError: string | null;
};

export function GameReviewsSection({
  gameTitle,
  reviews,
  reviewsError,
}: GameReviewsSectionProps): JSX.Element {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_55px_rgba(123,255,200,0.08)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(123,255,200,0.16),_transparent_60%)]" />
      <div className="absolute -left-24 bottom-0 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(255,107,138,0.18),_transparent_70%)]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Community reviews</h2>
          <p className="mt-2 text-xl font-semibold text-white">Player feedback from verified buyers</p>
        </div>
        <p className="text-sm text-[#dcfff2]/75 sm:max-w-sm sm:text-right">
          Verified purchase badges confirm the reviewer bought the game. Highlight thoughtful notes to help other players decide if the build is right for them.
        </p>
      </div>

      {reviewsError ? (
        <p className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-5 text-sm text-rose-100">{reviewsError}</p>
      ) : reviews.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-white/10 bg-[#080808]/80 p-6 text-sm text-[#dcfff2]/75">
          No reviews yet for {gameTitle}. Share the download link to gather the first wave of community impressions.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {reviews.map((review) => {
            const paragraphs = getReviewParagraphs(review.body_md);
            const trimmedBody = review.body_md.trim();
            const displayParagraphs = paragraphs.length > 0 ? paragraphs : trimmedBody ? [trimmedBody] : [];

            return (
              <article key={review.id} className="rounded-2xl border border-white/10 bg-[#060606]/90 p-6 shadow-[0_0_35px_rgba(123,255,200,0.07)]">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    {review.title ? (
                      <h3 className="text-lg font-semibold text-white">{review.title}</h3>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[#b8ffe5]/80">
                      {review.rating != null ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-amber-100">
                          <span aria-hidden className="text-base leading-none text-amber-300">★</span>
                          <span className="font-semibold text-amber-100">{review.rating}/5</span>
                          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/80">Rating</span>
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">
                          Comment only
                        </span>
                      )}
                      <time dateTime={review.created_at} className="text-[#b8ffe5]/70">
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
                  </div>
                </header>
                <div className="mt-4 space-y-3 text-base leading-7 text-[#f3fff9]/85">
                  {displayParagraphs.map((paragraph, index) => (
                    <p key={`${review.id}-paragraph-${index}`}>{paragraph}</p>
                  ))}
                </div>
                <FlagContentButton targetType="REVIEW" targetId={review.id} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
