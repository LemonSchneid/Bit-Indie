"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  HiddenModerationItem,
  ModerationActionResponse,
  ModerationTargetType,
  UserProfile,
  getHiddenModerationItems,
  restoreModerationTarget,
} from "../lib/api";
import {
  USER_PROFILE_STORAGE_EVENT,
  loadStoredUserProfile,
} from "../lib/user-storage";

const targetDescriptions: Record<ModerationTargetType, string> = {
  GAME: "game listing",
  COMMENT: "comment",
  REVIEW: "review",
};

const restoreLabels: Record<"COMMENT" | "REVIEW", string> = {
  COMMENT: "Restore comment",
  REVIEW: "Restore review",
};

type LoadState = "idle" | "loading" | "success" | "error";

type RestorableTarget = Pick<ModerationActionResponse, "target_type" | "target_id">;

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-US");
}

function summarizeBody(item: HiddenModerationItem): string | null {
  if (item.comment) {
    return item.comment.body_md;
  }
  if (item.review) {
    return item.review.body_md;
  }
  return null;
}

function truncate(value: string, maxLength = 220): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

function filterAfterRestore(
  items: HiddenModerationItem[],
  restored: RestorableTarget,
): HiddenModerationItem[] {
  return items.filter(
    (item) => !(item.target_type === restored.target_type && item.target_id === restored.target_id),
  );
}

export function AdminHiddenContent(): JSX.Element {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadStoredUserProfile());
  const [items, setItems] = useState<HiddenModerationItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<RestorableTarget | null>(null);
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
      setItems([]);
      setLoadState("idle");
      setLoadError(null);
    }
  }, [profile]);

  const refreshHiddenContent = useCallback(async () => {
    if (!profile || !profile.is_admin) {
      return;
    }

    setLoadState("loading");
    setLoadError(null);
    try {
      const hiddenItems = await getHiddenModerationItems(profile.id);
      setItems(hiddenItems);
      setLoadState("success");
    } catch (error: unknown) {
      setLoadState("error");
      if (error instanceof Error) {
        setLoadError(error.message);
      } else {
        setLoadError("Failed to load hidden content.");
      }
    }
  }, [profile]);

  useEffect(() => {
    if (profile && profile.is_admin) {
      void refreshHiddenContent();
    }
  }, [profile, refreshHiddenContent]);

  const handleRestore = useCallback(
    async (item: HiddenModerationItem) => {
      if (!profile || !profile.is_admin) {
        return;
      }

      if (item.target_type === "GAME") {
        setActionError("Game listings cannot be restored from this panel.");
        return;
      }

      setActionTarget({ target_type: item.target_type, target_id: item.target_id });
      setActionFeedback(null);
      setActionError(null);

      try {
        await restoreModerationTarget({
          user_id: profile.id,
          target_type: item.target_type,
          target_id: item.target_id,
        });
        setItems((previous) =>
          filterAfterRestore(previous, {
            target_type: item.target_type,
            target_id: item.target_id,
          }),
        );
        setActionFeedback("Content restored successfully.");
      } catch (error: unknown) {
        if (error instanceof Error) {
          setActionError(error.message);
        } else {
          setActionError("Failed to restore the selected content.");
        }
      } finally {
        setActionTarget(null);
      }
    },
    [profile],
  );

  const listIsEmpty = useMemo(
    () => loadState === "success" && items.length === 0,
    [loadState, items.length],
  );

  if (!profile || !profile.is_admin) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-white">Hidden content</h2>
        <p className="mt-4 text-slate-300">
          Sign in with an administrator account to review and restore previously hidden comments and
          reviews.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Hidden content</h2>
          <p className="mt-2 text-slate-300">
            Review previously hidden comments and reviews, then restore them once they are safe for the
            community again.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void refreshHiddenContent()}
            disabled={loadState === "loading"}
            className="inline-flex items-center justify-center rounded-full border border-sky-300/40 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadState === "loading" ? "Refreshing…" : "Refresh list"}
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

      {listIsEmpty ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 text-sm text-slate-300">
          <p className="font-semibold text-slate-100">No hidden items</p>
          <p className="mt-2 text-slate-300">
            There are no hidden comments or reviews waiting for restoration. Hidden items will appear here
            once a takedown is reversed.
          </p>
        </div>
      ) : null}

      <ul className="space-y-4">
        {items.map((item) => {
          const summary = summarizeBody(item);
          const isProcessing =
            actionTarget?.target_id === item.target_id && actionTarget?.target_type === item.target_type;

          const restoreLabel = restoreLabels[item.target_type as "COMMENT" | "REVIEW"];

          return (
            <li
              key={`${item.target_type}:${item.target_id}`}
              className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-sky-500/5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Hidden {targetDescriptions[item.target_type]}
                  </p>
                  <p className="text-lg font-semibold text-white">{item.game.title}</p>
                  <p className="text-xs text-slate-400">Slug · {item.game.slug}</p>
                  <p className="text-xs text-slate-400">Status · {item.game.status}</p>
                  {summary ? (
                    <blockquote className="mt-3 rounded-2xl border border-white/5 bg-slate-950/40 p-3 text-sm text-slate-200">
                      {truncate(summary)}
                    </blockquote>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    Originally posted on {formatTimestamp(item.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRestore(item)}
                  disabled={isProcessing}
                  className="inline-flex items-center justify-center rounded-full border border-sky-300/50 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isProcessing ? "Restoring…" : restoreLabel}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
