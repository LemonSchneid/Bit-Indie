import { type GameComment } from "../../lib/api";
import { formatDateLabel } from "../../lib/format";

import { ReviewBadge } from "./review-badge";
import {
  getCommentAuthorLabel,
  getCommentParagraphs,
} from "./utils";
import { FlagContentButton } from "./flag-content-button";

type GameCommentsSectionProps = {
  gameTitle: string;
  comments: GameComment[];
  commentsError: string | null;
};

export function GameCommentsSection({
  gameTitle,
  comments,
  commentsError,
}: GameCommentsSectionProps): JSX.Element {
  const displayComments = comments;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_55px_rgba(123,255,200,0.08)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(123,255,200,0.16),_transparent_60%)]" />
      <div className="absolute -right-24 bottom-0 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(255,107,138,0.18),_transparent_70%)]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">Community thread</h2>
          <p className="mt-2 text-xl font-semibold text-white">Comments from Bit Indie players</p>
        </div>
        <p className="text-sm text-[#dcfff2]/75 sm:max-w-sm sm:text-right">
          Share feedback from your download page and keep the discussion grounded in Bit Indie&apos;s first-party community. Verified
          purchase badges highlight players who bought the build.
        </p>
      </div>

      {commentsError ? (
        <p className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-5 text-sm text-rose-100">{commentsError}</p>
      ) : displayComments.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-white/10 bg-[#080808]/80 p-6 text-sm text-[#dcfff2]/75">
          No comments yet for {gameTitle}. Share the release note or invite players to leave feedback here.
        </p>
      ) : (
        <div className="relative z-10 mt-6 space-y-6">
          {displayComments.map((comment) => {
            const paragraphs = getCommentParagraphs(comment.body_md);
            const trimmedBody = comment.body_md.trim();
            const displayParagraphs = paragraphs.length > 0 ? paragraphs : trimmedBody ? [trimmedBody] : [];
            const authorLabel = getCommentAuthorLabel(comment);
            const authorTitle = comment.author.account_identifier ?? undefined;

            return (
              <article key={comment.id} className="rounded-2xl border border-white/10 bg-[#060606]/90 p-6 shadow-[0_0_35px_rgba(123,255,200,0.07)]">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="font-semibold text-white" title={authorTitle}>
                      {authorLabel}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[#b8ffe5]/70">
                      <time dateTime={comment.created_at} className="text-[#b8ffe5]/70">
                        {formatDateLabel(comment.created_at, { fallback: "Just now" })}
                      </time>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70">
                        Bit Indie
                      </span>
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
                  </div>
                </header>
                <div className="mt-4 space-y-3 text-base leading-7 text-[#f3fff9]/85">
                  {displayParagraphs.map((paragraph, index) => (
                    <p key={`${comment.id}-paragraph-${index}`}>{paragraph}</p>
                  ))}
                </div>
                <FlagContentButton targetType="COMMENT" targetId={comment.id} />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
