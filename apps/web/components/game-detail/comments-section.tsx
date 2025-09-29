import { type GameComment } from "../../lib/api";
import { formatDateLabel } from "../../lib/format";

import { ReviewBadge } from "./review-badge";
import {
  getCommentAuthorLabel,
  getCommentParagraphs,
} from "./utils";

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
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-lg shadow-emerald-500/10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_60%)]" />
      <div className="absolute -right-24 bottom-0 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(59,130,246,0.15),_transparent_70%)]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Community thread</h2>
          <p className="mt-2 text-xl font-semibold text-white">Comments from Bit Indie players</p>
        </div>
        <p className="text-sm text-slate-400 sm:max-w-sm sm:text-right">
          Share feedback from your download page and keep the discussion grounded in Bit Indie&apos;s first-party community. Verified
          purchase badges highlight players who bought the build.
        </p>
      </div>

      {commentsError ? (
        <p className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-5 text-sm text-rose-100">{commentsError}</p>
      ) : displayComments.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
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
                      <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
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
  );
}
