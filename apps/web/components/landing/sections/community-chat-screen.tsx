"use client";

import type { CommunityComment, ReviewHighlight } from "../landing-types";

import { MicroLabel, NeonCard, Pill } from "./shared";

type CommunityChatScreenProps = {
  comments: CommunityComment[];
  reviews: ReviewHighlight[];
  gameTitle: string;
};

export function CommunityChatScreen({ comments, reviews, gameTitle }: CommunityChatScreenProps): JSX.Element {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <NeonCard className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MicroLabel>Chat</MicroLabel>
          <Pill>First-party</Pill>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-[#9fb5aa]">
          Crew chat keeps every racer synced on the latest drops for {gameTitle}. Drop feedback, coordinate lobbies, and push
          highlights straight to the developer feed.
        </p>
        <div className="mt-6 space-y-4">
          {comments.map((comment) => (
            <div
              key={`${comment.author}-${comment.timeAgo}`}
              className="rounded-2xl border border-[#1f1f1f] bg-[rgba(10,15,12,0.92)] p-4 shadow-[0_0_24px_rgba(57,255,20,0.18)]"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-[#585858]">
                <span>{comment.author}</span>
                <span>{comment.timeAgo}</span>
              </div>
              <p className="mt-3 text-sm text-[#d1f2e4]">{comment.body}</p>
              {comment.verified ? (
                <span className="mt-4 inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.35em] text-[#7bffc8]">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#2dff85]/60 bg-[rgba(18,34,24,0.95)] text-[0.55rem] text-[#c9ffe9]">
                    ✓
                  </span>
                  Verified purchase
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-6 flex w-full flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Type a message to the crew"
            className="flex-1 min-w-[12rem] rounded-full border border-[#2dff85]/30 bg-[rgba(12,16,13,0.92)] px-4 py-3 text-sm text-[#d9ffe9] placeholder:text-[#4f6e60] focus:border-[#2dff85]/70 focus:outline-none"
            disabled
          />
          <button
            type="button"
            className="rounded-full border border-[#2dff85]/70 bg-[rgba(18,34,24,0.95)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#d9ffe9] shadow-[0_0_24px_rgba(57,255,20,0.3)] disabled:opacity-60"
            disabled
          >
            Send
          </button>
        </div>
        <p className="mt-2 text-[0.65rem] uppercase tracking-[0.35em] text-[#5b7a6b]">
          Sign in to post in realtime. Crew replies refresh every few seconds.
        </p>
      </NeonCard>
      <div className="space-y-6">
        <NeonCard className="p-6">
          <MicroLabel>Signal boosts</MicroLabel>
          <div className="mt-4 space-y-4">
            {reviews.map((review) => (
              <div key={review.summary} className="rounded-2xl border border-[#1f1f1f] bg-[rgba(9,9,9,0.92)] p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-[#585858]">
                  <span>{review.author}</span>
                  <span>{review.helpfulLabel}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{review.summary}</p>
                <p className="mt-2 text-sm text-[#9fb5aa]">{review.body}</p>
              </div>
            ))}
          </div>
        </NeonCard>
        <NeonCard className="p-6">
          <MicroLabel>Moderation feed</MicroLabel>
          <p className="mt-3 text-sm text-[#8fa39a]">
            First-party moderators keep the channel signal-strong. Reports route directly to the Bit Indie team for follow-up
            without waiting on third-party relays.
          </p>
          <div className="mt-4 space-y-3 text-[0.7rem] uppercase tracking-[0.35em] text-[#5b7a6b]">
            <div className="flex items-center justify-between">
              <span>Auto-mute spam</span>
              <span className="rounded-full border border-[#2dff85]/40 bg-[rgba(16,28,21,0.9)] px-3 py-1 text-[0.6rem] font-semibold text-[#c7ffe9]">
                Enabled
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Escalations today</span>
              <span className="rounded-full border border-[#2dff85]/20 bg-[rgba(12,16,13,0.92)] px-3 py-1 text-[0.6rem] font-semibold text-[#8fa39a]">
                0 pending
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Response time</span>
              <span className="rounded-full border border-[#2dff85]/20 bg-[rgba(12,16,13,0.92)] px-3 py-1 text-[0.6rem] font-semibold text-[#8fa39a]">
                &lt; 5 minutes
              </span>
            </div>
          </div>
        </NeonCard>
      </div>
    </div>
  );
}
