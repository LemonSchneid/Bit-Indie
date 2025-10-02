"use client";

import { describeChecklistState, type ChecklistState } from "./presenters";
import type { GamePublishChecklist } from "../../lib/api";

export type PublishActionStatus = "idle" | "loading" | "success" | "error";

export interface PublishActionState {
  status: PublishActionStatus;
  message: string | null;
}

interface PublishChecklistCardProps {
  checklist: GamePublishChecklist | null;
  state: ChecklistState;
  error: string | null;
  onRefresh: () => void;
  onPublish: () => void;
  publishState: PublishActionState;
  disabled?: boolean;
}

export function PublishChecklistCard({
  checklist,
  state,
  error,
  onRefresh,
  onPublish,
  publishState,
  disabled = false,
}: PublishChecklistCardProps): JSX.Element {
  const descriptor = describeChecklistState({ state, error, checklist });

  const bannerClass =
    descriptor.tone === "success"
      ? "text-emerald-200"
      : descriptor.tone === "error"
        ? "text-rose-200"
        : "text-slate-300";

  const publishDisabled =
    disabled || publishState.status === "loading" || !checklist?.is_publish_ready;

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Publish checklist</h3>
        <p className={`text-sm ${bannerClass}`}>{descriptor.message}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled || state === "loading"}
          className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "loading" ? "Refreshing…" : "Refresh checklist"}
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={publishDisabled}
          className="inline-flex items-center justify-center rounded-full border border-pink-400/40 bg-pink-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-pink-100 transition hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {publishState.status === "loading" ? "Publishing…" : "Publish draft"}
        </button>
      </div>

      {publishState.message ? (
        <p
          className={`text-xs ${
            publishState.status === "error"
              ? "text-rose-200"
              : publishState.status === "success"
                ? "text-emerald-200"
                : "text-slate-400"
          }`}
        >
          {publishState.message}
        </p>
      ) : null}

      {checklist && checklist.missing_requirements.length > 0 ? (
        <ul className="space-y-2 text-sm text-slate-300">
          {checklist.missing_requirements.map((item) => (
            <li
              key={item.code}
              className="rounded-2xl border border-white/5 bg-slate-950/40 p-3 text-xs text-slate-200"
            >
              {item.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
