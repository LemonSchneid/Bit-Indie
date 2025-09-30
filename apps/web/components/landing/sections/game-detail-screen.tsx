"use client";

import type {
  CommunityComment,
  DeveloperChecklistItem,
  ReviewHighlight,
} from "../landing-types";

import { cn, MicroLabel, NeonCard, Pill } from "./shared";

type DetailGameViewProps = {
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
  checklist: DeveloperChecklistItem[];
  verifiedReviewsCount: number;
};

export function GameDetailScreen({
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
  checklist,
  verifiedReviewsCount,
}: DetailGameViewProps): JSX.Element {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <NeonCard className="p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Pill>{statusLabel}</Pill>
          <Pill intent="magenta">{categoryLabel}</Pill>
          <Pill intent="slate">{versionLabel}</Pill>
        </div>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">{developerLabel}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-400/10 p-4 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
            <div className="h-56 rounded-xl bg-slate-900/80" />
            <p className="mt-3 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-200/80">Cover art placeholder</p>
          </div>
          <div className="space-y-6 text-sm text-slate-200">
            <p className="text-base text-slate-100">
              {title} pairs lightning-fast play with a marketplace tuned for sats.
            </p>
            <div className="space-y-3">
              {description.map((line) => (
                <p key={line} className="leading-relaxed text-slate-300">
                  {line}
                </p>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full border border-emerald-400/60 bg-emerald-500/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition hover:border-emerald-300 hover:text-emerald-100"
              >
                Launch Lightning purchase modal
              </button>
              <button
                type="button"
                className="rounded-full border border-fuchsia-400/60 bg-fuchsia-500/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-fuchsia-100 shadow-[0_0_30px_rgba(232,121,249,0.3)] transition hover:border-fuchsia-300"
              >
                Share crew invite
              </button>
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <NeonCard className="p-6">
            <MicroLabel>Support the developer</MicroLabel>
            <p className="mt-3 text-sm text-slate-300">
              Lightning tips will return alongside the refreshed account system. Until then, keep the hype going by sharing
              feedback with the team at
              <span className="ml-2 font-semibold text-emerald-200">{lightningAddress ?? "their usual channels"}</span>.
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">Suggested</span>
              <span className="text-lg font-semibold text-emerald-200">{tipLabel}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">Base price</span>
              <span className="text-lg font-semibold text-emerald-200">{priceLabel}</span>
            </div>
          </NeonCard>
          <NeonCard className="p-6">
            <MicroLabel>Player sentiment</MicroLabel>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-emerald-200/70">Rating</span>
                <span className="font-semibold text-emerald-200">4.8 / 5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-emerald-200/70">Verified reviews</span>
                <span className="font-semibold text-emerald-200">{verifiedReviewsCount.toLocaleString("en-US")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.35em] text-emerald-200/70">Community replies</span>
                <span className="font-semibold text-emerald-200">Fresh every hour</span>
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
              <div key={`${comment.author}-${comment.timeAgo}`} className="rounded-2xl border border-emerald-400/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-slate-500">
                  <span>{comment.author}</span>
                  <span>{comment.timeAgo}</span>
                </div>
                <p className="mt-3 text-sm text-slate-200">{comment.body}</p>
                {comment.verified ? (
                  <span className="mt-4 inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.35em] text-emerald-300">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/10 text-[0.55rem]">✓</span>
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
              <div key={review.summary} className="rounded-2xl border border-emerald-400/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-slate-500">
                  <span>{review.author}</span>
                  <span>{review.helpfulLabel}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-100">{review.summary}</p>
                <p className="mt-2 text-sm text-slate-300">{review.body}</p>
              </div>
            ))}
          </div>
        </NeonCard>
        <NeonCard className="p-6">
          <MicroLabel>Developer checklist</MicroLabel>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            {checklist.map((item) => (
              <li key={item.title} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[0.65rem] font-semibold",
                    item.complete
                      ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-200"
                      : "border-slate-700 text-slate-500",
                  )}
                >
                  {item.complete ? "✓" : ""}
                </span>
                <span className="uppercase tracking-[0.3em] text-slate-400">{item.title}</span>
              </li>
            ))}
          </ul>
        </NeonCard>
      </div>
    </div>
  );
}
