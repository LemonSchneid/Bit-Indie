"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { type FeaturedGameSummary } from "../lib/api";
import { formatCategory, formatDateLabel, formatPriceMsats } from "../lib/format";

type FeaturedRotationProps = {
  entries: FeaturedGameSummary[];
};

function formatRefundRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) {
    return "0% refund rate";
  }

  const percentage = Math.max(0, Math.min(rate, 1)) * 100;
  const fractionDigits = percentage >= 10 ? 0 : 1;
  return `${percentage.toLocaleString("en-US", { maximumFractionDigits: fractionDigits })}% refund rate`;
}

export function FeaturedRotation({ entries }: FeaturedRotationProps): JSX.Element | null {
  const games = useMemo(() => entries.filter((entry) => entry.game?.slug), [entries]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [games.length]);

  useEffect(() => {
    if (games.length <= 1) {
      return undefined;
    }

    const id = window.setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % games.length);
    }, 6000);

    return () => window.clearInterval(id);
  }, [games.length]);

  if (games.length === 0) {
    return null;
  }

  const boundedIndex = ((activeIndex % games.length) + games.length) % games.length;
  const current = games[boundedIndex];
  const { game } = current;
  const priceLabel = formatPriceMsats(game.price_msats);
  const refundLabel = formatRefundRate(current.refund_rate);
  const updatedLabel = formatDateLabel(game.updated_at, { fallback: "Updated recently" });

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-lg shadow-emerald-500/10 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-200">
            Featured rotation
          </span>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Spotlighted indie builds</h2>
          <p className="text-sm text-slate-300">
            Games earn the spotlight with ten verified player comments, a healthy refund score, and fresh updates within the last month.
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <button
            type="button"
            className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-300/60 hover:bg-emerald-400/15 hover:text-emerald-100"
            onClick={() => setActiveIndex((previous) => (previous - 1 + games.length) % games.length)}
            aria-label="Show previous featured game"
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-emerald-300/60 hover:bg-emerald-400/15 hover:text-emerald-100"
            onClick={() => setActiveIndex((previous) => (previous + 1) % games.length)}
            aria-label="Show next featured game"
          >
            Next
          </button>
        </div>
      </div>

      <div className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-35 blur-sm"
          style={game.cover_url ? { backgroundImage: `url(${game.cover_url})` } : undefined}
        />
        <div className="relative grid gap-8 p-8 backdrop-blur-sm lg:grid-cols-[3fr_2fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-200">
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1">{formatCategory(game.category)}</span>
              <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-1 text-emerald-200">{priceLabel}</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1">Updated {updatedLabel}</span>
            </div>
            <h3 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{game.title}</h3>
            {game.summary ? (
              <p className="text-base text-slate-200 sm:text-lg">{game.summary}</p>
            ) : (
              <p className="text-base text-slate-200 sm:text-lg">
                {`No summary provided yet. Jump in via the listing to see what's new.`}
              </p>
            )}
            <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200">
              <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-slate-100">
                {current.verified_comment_count.toLocaleString("en-US")} verified comments
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-slate-100">
                {refundLabel}
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-slate-100">
                {current.paid_purchase_count.toLocaleString("en-US")} paid purchases
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-slate-100">
                {current.refunded_purchase_count.toLocaleString("en-US")} refunds processed
              </span>
            </div>
            <Link
              href={`/games/${game.slug}`}
              className="inline-flex w-fit items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400/15 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:border-emerald-200 hover:bg-emerald-400/25 hover:text-emerald-50"
            >
              View listing
            </Link>
          </div>
          <div className="flex flex-col justify-between gap-6 rounded-3xl border border-white/15 bg-slate-950/70 p-6 text-sm text-slate-200">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Eligibility snapshot</p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed">
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="font-semibold text-white">{current.verified_comment_count.toLocaleString("en-US")}</span>{" "}
                  verified comments
                </li>
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="font-semibold text-white">{current.paid_purchase_count.toLocaleString("en-US")}</span>{" "}
                  paid purchases
                </li>
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Refund rate under 5% requirement
                </li>
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Updated within the last 30 days
                </li>
              </ul>
            </div>
            <p className="text-xs text-slate-400">
              Featured status is recalculated automatically whenever comments, purchases, or refunds change.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {games.map((entry, index) => {
            const isActive = index === boundedIndex;
            return (
              <button
                key={entry.game.id}
                type="button"
                aria-label={`Show ${entry.game.title}`}
                onClick={() => setActiveIndex(index)}
                className={`h-2 w-10 rounded-full transition ${
                  isActive ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]" : "bg-white/15 hover:bg-white/30"
                }`}
              />
            );
          })}
        </div>
        <p className="text-xs text-slate-400">
          Rotation updates as new games meet the criteria. Only active listings with fresh updates are displayed.
        </p>
      </div>
    </section>
  );
}
