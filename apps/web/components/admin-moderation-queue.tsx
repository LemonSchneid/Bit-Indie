"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ModerationActionResponse,
  ModerationFlagReason,
  ModerationQueueItem,
  ModerationTargetType,
  UserProfile,
  executeModerationTakedown,
  getModerationQueue,
} from "../lib/api";
import {
  USER_PROFILE_STORAGE_EVENT,
  loadStoredUserProfile,
} from "../lib/user-storage";

const reasonLabels: Record<ModerationFlagReason, string> = {
  SPAM: "Spam or unsolicited promotion",
  TOS: "Terms of service violation",
  DMCA: "Copyright or DMCA complaint",
  MALWARE: "Malicious or unsafe content",
};

const targetLabels: Record<ModerationTargetType, string> = {
  GAME: "game listing",
  COMMENT: "comment",
  REVIEW: "review",
};

const actionLabels: Record<ModerationTargetType, string> = {
  GAME: "Unlist game",
  COMMENT: "Hide comment",
  REVIEW: "Hide review",
};

type LoadState = "idle" | "loading" | "success" | "error";

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-US");
}

function formatReporterName(item: ModerationQueueItem): string {
  const reporter = item.reporter;
  if (reporter.display_name) {
    return reporter.display_name;
  }
  if (!reporter.account_identifier) {
    return "Unknown reporter";
  }
  if (reporter.account_identifier.length <= 14) {
    return reporter.account_identifier;
  }
  const prefix = reporter.account_identifier.slice(0, 8);
  const suffix = reporter.account_identifier.slice(-6);
  return `${prefix}…${suffix}`;
}

function truncate(text: string, maxLength = 200): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function filterQueueAfterAction(
  queue: ModerationQueueItem[],
  action: ModerationActionResponse,
  fallbackItem: ModerationQueueItem,
): ModerationQueueItem[] {
  if (action.affected_flag_ids.length > 0) {
    const affected = new Set(action.affected_flag_ids);
    return queue.filter((flag) => !affected.has(flag.id));
  }
  return queue.filter(
    (flag) =>
      !(flag.target_type === fallbackItem.target_type && flag.target_id === fallbackItem.target_id),
  );
}

export function AdminModerationQueue(): JSX.Element {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadStoredUserProfile());
  const [queue, setQueue] = useState<ModerationQueueItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    function handleProfileChange() {
      setProfile(loadStoredUserProfile());
    }

    window.addEventListener(USER_PROFILE_STORAGE_EVENT, handleProfileChange);
    return () => window.removeEventListener(USER_PROFILE_STORAGE_EVENT, handleProfileChange);
  }, []);

  useEffect(() => {
    if (!profile || !profile.is_admin) {
      setQueue([]);
      setLoadState("idle");
      setLoadError(null);
    }
  }, [profile]);

  const refreshQueue = useCallback(async () => {
    if (!profile || !profile.is_admin) {
      return;
    }

    setLoadState("loading");
    setLoadError(null);
    try {
      const items = await getModerationQueue(profile.id);
      setQueue(items);
      setLoadState("success");
    } catch (error: unknown) {
      setLoadState("error");
      if (error instanceof Error) {
        setLoadError(error.message);
      } else {
        setLoadError("Failed to load the moderation queue.");
      }
    }
  }, [profile]);

  useEffect(() => {
    if (profile && profile.is_admin) {
      void refreshQueue();
    }
  }, [profile, refreshQueue]);

  const handleTakedown = useCallback(
    async (item: ModerationQueueItem) => {
      if (!profile || !profile.is_admin) {
        return;
      }

      setActionTargetId(item.id);
      setActionFeedback(null);
      setActionError(null);

      try {
        const response = await executeModerationTakedown({
          user_id: profile.id,
          target_type: item.target_type,
          target_id: item.target_id,
        });
        setQueue((previous) => filterQueueAfterAction(previous, response, item));
        setActionFeedback("Takedown applied successfully.");
      } catch (error: unknown) {
        if (error instanceof Error) {
          setActionError(error.message);
        } else {
          setActionError("Failed to apply the moderation action.");
        }
      } finally {
        setActionTargetId(null);
      }
    },
    [profile],
  );

  const queueIsEmpty = useMemo(
    () => loadState === "success" && queue.length === 0,
    [loadState, queue.length],
  );

  if (!profile || !profile.is_admin) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-white">Moderation queue</h2>
        <p className="mt-4 text-slate-300">
          Sign in with an administrator account to review reported games, comments, and reviews. Only
          administrators can unlist listings or hide abusive content.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Moderation queue</h2>
          <p className="mt-2 text-slate-300">
            Review flagged content, unlist harmful games, and hide abusive notes in a single pass.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void refreshQueue()}
            disabled={loadState === "loading"}
            className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadState === "loading" ? "Refreshing…" : "Refresh queue"}
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          {loadError}
        </div>
      ) : null}

      {actionFeedback ? (
        <div className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {actionFeedback}
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          {actionError}
        </div>
      ) : null}

      {queueIsEmpty ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 text-sm text-slate-300">
          <p className="font-semibold text-slate-100">No open flags</p>
          <p className="mt-2 text-slate-300">
            There are currently no open moderation flags. Keep an eye out for new reports and refresh
            the queue as needed.
          </p>
        </div>
      ) : null}

      <ul className="space-y-4">
        {queue.map((item) => {
          const buttonLabel = actionLabels[item.target_type];
          const reasonLabel = reasonLabels[item.reason];
          const isProcessing = actionTargetId === item.id;
          const contentSummary = item.comment?.body_md ?? item.review?.body_md ?? null;

          return (
            <li
              key={item.id}
              className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-emerald-500/5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Flagged {targetLabels[item.target_type]}
                  </p>
                  <p className="text-lg font-semibold text-white">{reasonLabel}</p>
                  {item.game ? (
                    <div className="mt-2 rounded-2xl border border-white/5 bg-slate-950/40 p-3 text-sm">
                      <p className="font-semibold text-white">{item.game.title}</p>
                      <p className="text-xs text-slate-400">Slug · {item.game.slug}</p>
                      <p className="text-xs text-slate-400">Status · {item.game.status}</p>
                    </div>
                  ) : null}
                  {contentSummary ? (
                    <blockquote className="mt-2 rounded-2xl border border-white/5 bg-slate-950/40 p-3 text-sm text-slate-200">
                      {truncate(contentSummary)}
                    </blockquote>
                  ) : null}
                  {item.review?.rating ? (
                    <p className="text-xs text-amber-200">Rating · {item.review.rating} / 5</p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    Reported by {formatReporterName(item)} on {formatTimestamp(item.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleTakedown(item)}
                  disabled={isProcessing}
                  className="inline-flex items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isProcessing ? "Applying…" : buttonLabel}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
