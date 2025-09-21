"use client";

import { ZapButton } from "../zap-button";
import type { GameDetail, MockComment } from "./types";
import { MicroLabel, NeonCard, Pill } from "./ui";
import { formatSats, formatZapAmount } from "./utils";

export function GameDetailScreen({
  game,
  comments,
  onBack,
  onLaunchCheckout,
}: {
  game: GameDetail;
  comments: MockComment[];
  onBack: () => void;
  onLaunchCheckout: () => void;
}) {
  const priceDisplay = game.priceSats !== null ? `${game.priceSats.toLocaleString()} sats` : "Free";
  const [firstParagraph, ...additionalParagraphs] = game.description;
  const coverArtLabel = game.coverArt ? `Cover art: ${game.coverArt}` : "Cover art placeholder";

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-100"
      >
        ← Back to storefront
      </button>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <NeonCard className="p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Pill>{game.status}</Pill>
            <Pill intent="magenta">{game.category}</Pill>
            <Pill intent="slate">Version {game.version}</Pill>
          </div>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white">{game.title}</h2>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">{game.developer}</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
            <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-400/10 p-4 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
              <div className="h-56 rounded-xl bg-slate-900/80" />
              <p className="mt-3 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-200/80">{coverArtLabel}</p>
            </div>
            <div className="space-y-6 text-sm text-slate-200">
              <p className="text-base text-slate-100">
                {firstParagraph ?? "Dive into a Lightning-enabled adventure crafted for Proof of Play explorers."}
              </p>
              {additionalParagraphs.length > 0 ? (
                <div className="space-y-3">
                  {additionalParagraphs.map((line) => (
                    <p key={line} className="leading-relaxed text-slate-300">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onLaunchCheckout}
                  className="rounded-full border border-emerald-400/60 bg-emerald-500/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition hover:border-emerald-300 hover:text-emerald-100"
                >
                  Launch Lightning purchase modal
                </button>
              </div>
            </div>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <NeonCard className="p-6">
              <MicroLabel>Tip the developer</MicroLabel>
              <p className="mt-3 text-sm text-slate-300">
                Send instant support via Lightning Address
                <span className="ml-2 font-semibold text-emerald-200">{game.lightningAddress}</span>
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">Suggested</span>
                <span className="text-lg font-semibold text-emerald-200">{game.tipRecommended.toLocaleString()} sats</span>
              </div>
              <button
                type="button"
                className="mt-6 w-full rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
              >
                Send zap
              </button>
            </NeonCard>
            <NeonCard className="p-6">
              <MicroLabel>Release cadence</MicroLabel>
              <div className="mt-4 space-y-4 text-sm text-slate-300">
                <GameMetric label="Last update" value={new Date(game.lastUpdated).toLocaleDateString()} />
                <GameMetric label="Patch notes" value="Nightfall balance + crew pass" />
                <GameMetric label="Refund rate" value="0.8%" />
              </div>
            </NeonCard>
          </div>
          <div className="mt-10">
            <NeonCard className="p-6">
              <MicroLabel>Community comments</MicroLabel>
              <div className="mt-4 space-y-4">
                {comments.map((comment) => (
                  <div key={comment.author} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
                    <div className="flex flex-wrap items-center gap-3 text-[0.7rem] uppercase tracking-[0.35em] text-slate-400">
                      <span>{comment.author}</span>
                      <span className="text-slate-600">•</span>
                      <span>{comment.timeAgo}</span>
                      {comment.verified ? (
                        <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[0.6rem] font-semibold tracking-[0.35em] text-emerald-200">
                          Verified purchase
                        </span>
                      ) : null}
                      {comment.zapMsats > 0 ? (
                        <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-amber-100">
                          ⚡ {formatZapAmount(comment.zapMsats)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-slate-200">{comment.body}</p>
                    <div className="mt-4">
                      <ZapButton
                        lightningAddress={comment.lightningAddress ?? undefined}
                        recipientLabel={comment.author}
                        comment={`Zap mock comment by ${comment.author}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </NeonCard>
          </div>
        </NeonCard>
        <div className="space-y-6">
          <NeonCard className="p-6">
            <MicroLabel>Purchase status</MicroLabel>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <GameMetric label="Price" value={priceDisplay} />
              <GameMetric label="Lightning ready" value="Instant" />
              <GameMetric label="Verified zaps" value="312,400 sats" />
            </div>
          </NeonCard>
          <NeonCard className="p-6">
            <MicroLabel>Player sentiment</MicroLabel>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <GameMetric label="Rating" value="4.8 / 5" />
              <GameMetric label="Verified reviews" value="124" />
              <GameMetric label="Latest zap" value="2 min ago" />
            </div>
          </NeonCard>
        </div>
      </div>
    </div>
  );
}

function GameMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="uppercase tracking-[0.35em] text-emerald-200/70">{label}</span>
      <span className="font-semibold text-emerald-200">{value}</span>
    </div>
  );
}
