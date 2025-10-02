"use client";

import { useMemo } from "react";

import {
  formatIntegrityCount,
  formatIntegrityHours,
  formatIntegrityMsats,
  formatIntegrityPercentage,
} from "../lib/format/admin-integrity";
import { useAdminIntegrityMetrics } from "../lib/hooks/use-admin-integrity-metrics";

export function AdminIntegrityDashboard(): JSX.Element {
  const { profile, stats, loadState, error, refresh } = useAdminIntegrityMetrics();

  const isEmpty = useMemo(() => {
    if (!stats) {
      return true;
    }
    return stats.paid_purchase_count === 0 && stats.total_flag_count === 0;
  }, [stats]);

  if (!profile || !profile.is_admin) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-white">Integrity metrics</h2>
        <p className="mt-4 text-slate-300">
          Sign in with an administrator account to review refund trends and moderation throughput. These
          metrics help operations spot risky titles and allocate moderator time.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Integrity metrics</h2>
          <p className="mt-2 text-slate-300">
            Track refund ratios, takedown rates, and estimated moderator hours to understand marketplace
            health.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loadState === "loading"}
            className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadState === "loading" ? "Refreshing…" : "Refresh metrics"}
          </button>
        </div>
      </div>

      {loadState === "error" && error ? (
        <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
      ) : null}

      {loadState === "loading" && !stats ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
          Loading integrity metrics…
        </div>
      ) : null}

      {stats ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 text-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Refund rate</h3>
              <p className="mt-3 text-3xl font-semibold text-white">{formatIntegrityPercentage(stats.refund_rate)}</p>
              <p className="mt-2 text-xs text-slate-400">
                {formatIntegrityCount(stats.refunded_purchase_count)} refunded purchases out of {formatIntegrityCount(stats.paid_purchase_count)} paid.
              </p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 text-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Takedown rate</h3>
              <p className="mt-3 text-3xl font-semibold text-white">{formatIntegrityPercentage(stats.takedown_rate)}</p>
              <p className="mt-2 text-xs text-slate-400">
                {formatIntegrityCount(stats.actioned_flag_count)} takedowns processed across {formatIntegrityCount(stats.total_flag_count)} flags.
              </p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 text-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Moderator hours</h3>
              <p className="mt-3 text-3xl font-semibold text-white">{formatIntegrityHours(stats.estimated_moderation_hours)} hrs</p>
              <p className="mt-2 text-xs text-slate-400">
                Estimated from {formatIntegrityCount(stats.handled_flag_count)} handled flags with a 6 minute average per review.
              </p>
            </article>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-200">
            {isEmpty ? (
              <p className="text-slate-300">No purchase or moderation data has been recorded yet.</p>
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Refund payouts</dt>
                  <dd className="mt-2 text-base text-white">{formatIntegrityMsats(stats.total_refund_payout_msats)}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Handled flags</dt>
                  <dd className="mt-2 text-base text-white">{formatIntegrityCount(stats.handled_flag_count)}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Open flags</dt>
                  <dd className="mt-2 text-base text-white">{formatIntegrityCount(stats.open_flag_count)}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
