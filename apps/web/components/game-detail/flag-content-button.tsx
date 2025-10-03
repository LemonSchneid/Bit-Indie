"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type ModerationFlagPayload,
  type ModerationFlagReason,
  type ModerationTargetType,
  submitModerationFlag,
} from "../../lib/api";
import {
  USER_PROFILE_STORAGE_EVENT,
  loadStoredUserProfile,
} from "../../lib/user-storage";

const reasonOptions: { value: ModerationFlagReason; label: string }[] = [
  { value: "SPAM", label: "Spam or unsolicited promotion" },
  { value: "TOS", label: "Terms of service violation" },
  { value: "DMCA", label: "Copyright or DMCA issue" },
  { value: "MALWARE", label: "Malware or security risk" },
];

type FlagContentButtonProps = {
  targetType: ModerationTargetType;
  targetId: string;
};

export function FlagContentButton({ targetType, targetId }: FlagContentButtonProps): JSX.Element {
  const [profile, setProfile] = useState(() => loadStoredUserProfile());
  const [reason, setReason] = useState<ModerationFlagReason>("SPAM");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    function handleProfileChange() {
      setProfile(loadStoredUserProfile());
    }

    window.addEventListener(USER_PROFILE_STORAGE_EVENT, handleProfileChange);
    return () => window.removeEventListener(USER_PROFILE_STORAGE_EVENT, handleProfileChange);
  }, []);

  useEffect(() => {
    if (!profile) {
      setStatus("idle");
      setFeedback(null);
      setError(null);
    }
  }, [profile]);

  const reasonLabel = useMemo(() => {
    return reasonOptions.find((option) => option.value === reason)?.label ?? "Spam or unsolicited promotion";
  }, [reason]);

  const handleSubmit = useCallback(async () => {
    if (!profile) {
      setError("Sign in to report this content to Bit Indie moderators.");
      return;
    }

    const payload: ModerationFlagPayload = {
      user_id: profile.id,
      target_type: targetType,
      target_id: targetId,
      reason,
    };

    setStatus("submitting");
    setFeedback(null);
    setError(null);

    try {
      await submitModerationFlag(payload);
      setStatus("success");
      setFeedback("Report submitted. Thanks for helping moderate the community.");
    } catch (unknownError) {
      setStatus("idle");
      if (unknownError instanceof Error) {
        setError(unknownError.message);
      } else {
        setError("Unable to submit the moderation report right now.");
      }
    }
  }, [profile, targetType, targetId, reason]);

  return (
    <div className="mt-4 space-y-2 text-xs text-[#b8ffe5]/70">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`${targetId}-flag-reason`} className="sr-only">
          Select a report reason
        </label>
        <select
          id={`${targetId}-flag-reason`}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-[#0f1f1a] focus:border-emerald-300 focus:outline-none"
          value={reason}
          onChange={(event) => setReason(event.target.value as ModerationFlagReason)}
          disabled={status === "success"}
        >
          {reasonOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={status === "submitting" || status === "success"}
          className="inline-flex items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-100 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" ? "Reporting…" : status === "success" ? "Reported" : "Report"}
        </button>
        <span className="text-[11px] text-[#dcfff2]/60">{reasonLabel}</span>
      </div>
      {feedback ? <p className="text-[11px] text-emerald-200">{feedback}</p> : null}
      {error ? <p className="text-[11px] text-rose-200">{error}</p> : null}
      {!profile && !error ? (
        <p className="text-[11px] text-[#dcfff2]/60">Sign in to report inappropriate content.</p>
      ) : null}
    </div>
  );
}

