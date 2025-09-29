"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AdminIntegrityStats,
  UserProfile,
  getAdminIntegrityStats,
} from "../lib/api";
import {
  USER_PROFILE_STORAGE_EVENT,
  loadStoredUserProfile,
} from "../lib/user-storage";

type LoadState = "idle" | "loading" | "success" | "error";

function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }
  const clamped = Math.max(0, Math.min(value, 1));
  return `${(clamped * 100).toFixed(1)}%`;
}

function formatHours(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatMsats(value: number): string {
  const msats = Math.max(0, value);
  const sats = msats / 1000;
  const formattedMsats = msats.toLocaleString("en-US");
  const formattedSats = sats.toLocaleString("en-US", {
    minimumFractionDigits: sats > 0 && sats < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${formattedMsats} msats (${formattedSats} sats)`;
}

function formatCount(value: number): string {
  return Math.max(0, value).toLocaleString("en-US");
}

export function AdminIntegrityDashboard(): JSX.Element {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadStoredUserProfile());
  const [stats, setStats] = useState<AdminIntegrityStats | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleProfileChange() {
      setProfile(loadStoredUserProfile());
    }

    window.addEventListener(USER_PROFILE_STORAGE_EVENT, handleProfileChange);
    return () => window.removeEventListener(USER_PROFILE_STORAGE_EVENT, handleProfileChange);
  }, []);

  useEffect(() => {
    if (!profile || !profile.is_admin) {
      setStats(null);
      setLoadState("idle");
      setError(null);
    }
  }, [profile]);

  const refreshStats = useCallback(async () => {
    if (!profile || !profile.is_admin) {
      return;
    }

    setLoadState("loading");
    setError(null);
    try {
      const payload = await getAdminIntegrityStats(profile.id);
      setStats(payload);
      setLoadState("success");
    } catch (cause) {
      setLoadState("error");
      if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Unable to load integrity metrics.");
      }
    }
  }, [profile]);

  useEffect(() => {
    if (profile && profile.is_admin) {
      void refreshStats();
    }
  }, [profile, refreshStats]);

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
            onClick={() => void refreshStats()}
            disabled={loadState === "loading"}
            className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadState === "loading" ? "Refreshing…" : "Refresh metrics"}
          </button>
        </div>
      </div>

      {loadState === "error" && error ? (
        <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
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
              <p className="mt-3 text-3xl font-semibold text-white">{formatPercentage(stats.refund_rate)}</p>
              <p className="mt-2 text-xs text-slate-400">
                {formatCount(stats.refunded_purchase_count)} refunded purchases out of {formatCount(stats.paid_purchase_count)}
                {" "}
                paid.
              </p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 text-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Takedown rate</h3>
              <p className="mt-3 text-3xl font-semibold text-white">{formatPercentage(stats.takedown_rate)}</p>
              <p className="mt-2 text-xs text-slate-400">
                {formatCount(stats.actioned_flag_count)} takedowns processed across {formatCount(stats.total_flag_count)} flags.
              </p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 text-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Moderator hours</h3>
              <p className="mt-3 text-3xl font-semibold text-white">{formatHours(stats.estimated_moderation_hours)} hrs</p>
              <p className="mt-2 text-xs text-slate-400">
                Estimated from {formatCount(stats.handled_flag_count)} handled flags with a 6 minute average per review.
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
                  <dd className="mt-2 text-base text-white">{formatMsats(stats.total_refund_payout_msats)}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Handled flags</dt>
                  <dd className="mt-2 text-base text-white">{formatCount(stats.handled_flag_count)}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Open flags</dt>
                  <dd className="mt-2 text-base text-white">{formatCount(stats.open_flag_count)}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
