"use client";

import type { CommunityComment, ReviewHighlight } from "../landing-types";

import { MicroLabel, NeonCard, Pill } from "./shared";

type PlayerInfoScreenProps = {
  title: string;
  statusLabel: string;
  categoryLabel: string;
  versionLabel: string;
  developerLabel: string;
  lightningAddress: string | null;
  priceLabel: string;
  tipLabel: string;
  description: string[];
  comments: CommunityComment[];
  reviews: ReviewHighlight[];
  verifiedReviewsCount: number;
};

export function PlayerInfoScreen({
  title,
  statusLabel,
  categoryLabel,
  versionLabel,
  developerLabel,
  lightningAddress,
  priceLabel,
  tipLabel,
  description,
  comments,
  reviews,
  verifiedReviewsCount,
}: PlayerInfoScreenProps): JSX.Element {
  const playerChecklist = [
    "Grab the latest build from your receipts page",
    "Link a Lightning wallet so tips land instantly",
    "Drop a review once you clear the first crew contract",
  ];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <NeonCard className="p-8">
        <MicroLabel>Info for players</MicroLabel>
        <div className="flex flex-wrap items-center gap-3">
          <Pill>{statusLabel}</Pill>
          <Pill intent="magenta">{categoryLabel}</Pill>
          <Pill intent="slate">{versionLabel}</Pill>
        </div>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="text-xs uppercase tracking-[0.4em] text-[#7bffc8]/70">{developerLabel}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <div className="rounded-2xl border border-[#2dff85]/35 bg-[radial-gradient(circle_at_top,_rgba(57,255,20,0.2),_transparent_70%)] p-4 shadow-[0_0_40px_rgba(57,255,20,0.28)]">
            <div className="h-56 rounded-xl bg-[rgba(15,15,15,0.9)]" />
            <p className="mt-3 text-[0.7rem] uppercase tracking-[0.4em] text-[#7bffc8]/80">Cover art placeholder</p>
          </div>
          <div className="space-y-6 text-sm text-[#9fb5aa]">
            <p className="text-base text-[#ebfff4]">
              {title} keeps the crew synced with Lightning receipts, instant patches, and verified community boosts.
            </p>
            <div className="space-y-3">
              {description.map((line) => (
                <p key={line} className="leading-relaxed text-[#8fa39a]">
                  {line}
                </p>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full border border-[#2dff85]/70 bg-[rgba(18,34,24,0.95)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#d9ffe9] shadow-[0_0_30px_rgba(57,255,20,0.3)] transition hover:border-[#7affc8] hover:text-white"
              >
                Checkout with Lightning
              </button>
              <button
                type="button"
                className="rounded-full border border-[#3ab4ff]/60 bg-[rgba(12,27,33,0.9)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#9bf5ff] shadow-[0_0_28px_rgba(58,180,255,0.28)] transition hover:border-[#6cd9ff]"
              >
                Invite your crew
              </button>
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <NeonCard className="p-6">
            <MicroLabel>Buy & support</MicroLabel>
            <p className="mt-3 text-sm text-[#8fa39a]">
              Pay in sats, keep your download synced, and share feedback directly with the crew at
              <span className="ml-2 font-semibold text-[#abffd9]">{lightningAddress ?? "their usual channels"}</span>.
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.4em] text-[#7bffc8]/70">Suggested</span>
              <span className="text-lg font-semibold text-[#abffd9]">{tipLabel}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.4em] text-[#7bffc8]/70">Base price</span>
              <span className="text-lg font-semibold text-[#abffd9]">{priceLabel}</span>
            </div>
          </NeonCard>
          <NeonCard className="p-6">
            <MicroLabel>Player sentiment</MicroLabel>
            <div className="mt-4 space-y-4 text-sm text-[#8fa39a]">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-[#7bffc8]/70">Rating</span>
                <span className="font-semibold text-[#abffd9]">4.8 / 5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-[#7bffc8]/70">Verified reviews</span>
                <span className="font-semibold text-[#abffd9]">{verifiedReviewsCount.toLocaleString("en-US")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-[#7bffc8]/70">Community replies</span>
                <span className="font-semibold text-[#abffd9]">Fresh every hour</span>
              </div>
            </div>
          </NeonCard>
        </div>
      </NeonCard>
      <div className="space-y-6">
        <NeonCard className="p-6">
          <MicroLabel>Community comments</MicroLabel>
          <div className="mt-4 space-y-4">
            {comments.map((comment) => (
              <div key={`${comment.author}-${comment.timeAgo}`} className="rounded-2xl border border-[#1f1f1f] bg-[rgba(9,9,9,0.92)] p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-[#585858]">
                  <span>{comment.author}</span>
                  <span>{comment.timeAgo}</span>
                </div>
                <p className="mt-3 text-sm text-[#c8e6d8]">{comment.body}</p>
                {comment.verified ? (
                  <span className="mt-4 inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.35em] text-[#7bffc8]">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#2dff85]/60 bg-[rgba(18,34,24,0.95)] text-[0.55rem] text-[#c9ffe9]">✓</span>
                    Verified purchase
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </NeonCard>
        <NeonCard className="p-6">
          <MicroLabel>Community reviews</MicroLabel>
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
          <MicroLabel>Player checklist</MicroLabel>
          <ul className="mt-4 space-y-3 text-sm text-[#b6d7c7]">
            {playerChecklist.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#2dff85]/60 bg-[rgba(18,34,24,0.95)] text-[0.65rem] font-semibold text-[#c7ffe9]">
                  ✓
                </span>
                <span className="uppercase tracking-[0.3em] text-[#6f7f77]">{item}</span>
              </li>
            ))}
          </ul>
        </NeonCard>
      </div>
    </div>
  );
}
