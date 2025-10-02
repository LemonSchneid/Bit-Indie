"use client";

import { type PropsWithChildren } from "react";

import { DraftInputField } from "./fields";
import { type GameDraftFormValues } from "./form-utils";
import { type ScanStatusDisplay } from "./scan-metadata";

interface GameDraftFormHeaderProps {
  hasDraft: boolean;
  onStartNewDraft: () => void;
}

export function GameDraftFormHeader({
  hasDraft,
  onStartNewDraft,
}: GameDraftFormHeaderProps): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          {hasDraft ? "Update your game draft" : "Create a game draft"}
        </h3>
        <p className="mt-3 text-sm text-slate-300">
          Save progress on an UNLISTED game listing. You can revisit and update the draft as you iterate on your build.
        </p>
      </div>
      {hasDraft ? (
        <button
          type="button"
          onClick={onStartNewDraft}
          className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:bg-emerald-400/20"
        >
          Start new draft
        </button>
      ) : null}
    </div>
  );
}

interface BuildMetadataSectionProps {
  values: Pick<
    GameDraftFormValues,
    "build_object_key" | "build_size_bytes" | "checksum_sha256"
  >;
  disabled: boolean;
  draftId: string | null;
  scanInfo: ScanStatusDisplay | null;
  scanMessage: string | null;
  lastScannedAt: string | null;
  onFieldChange: (field: keyof GameDraftFormValues, value: string) => void;
}

export function BuildMetadataSection({
  values,
  disabled,
  draftId,
  scanInfo,
  scanMessage,
  lastScannedAt,
  onFieldChange,
}: BuildMetadataSectionProps): JSX.Element {
  const hasDraft = Boolean(draftId);
  const placeholder = draftId ? `games/${draftId}/build/v1.0.0.zip` : "games/<id>/build/v1.0.0.zip";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Build submission</h4>
          <p className="mt-1 text-xs text-slate-400">
            Upload your build to storage, then record the object key, file size, and checksum so we can scan it.
          </p>
        </div>
        {hasDraft ? (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${scanInfo?.badgeClass ?? "bg-slate-500/30 text-slate-200"}`}
          >
            {scanInfo?.label ?? "Not scanned"}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <DraftInputField
          id="draft-build-key"
          label="Build object key"
          name="build_object_key"
          value={values.build_object_key}
          placeholder={placeholder}
          disabled={disabled}
          className="disabled:cursor-not-allowed disabled:opacity-60"
          helperText="Use the exact key returned by the upload API."
          helperTextClassName="text-slate-500"
          onValueChange={(value) => onFieldChange("build_object_key", value)}
        />
        <DraftInputField
          id="draft-build-size"
          label="Build size (bytes)"
          name="build_size_bytes"
          value={values.build_size_bytes}
          placeholder="734003200"
          disabled={disabled}
          className="disabled:cursor-not-allowed disabled:opacity-60"
          helperText="Record the exact byte size after compression."
          helperTextClassName="text-slate-500"
          onValueChange={(value) => onFieldChange("build_size_bytes", value)}
        />
      </div>

      <div className="mt-4">
        <DraftInputField
          id="draft-checksum"
          label="SHA-256 checksum"
          name="checksum_sha256"
          value={values.checksum_sha256}
          placeholder="64-character hex digest"
          disabled={disabled}
          className="font-mono text-xs uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
          onValueChange={(value) => onFieldChange("checksum_sha256", value)}
        />
      </div>

      {hasDraft ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Malware scan</p>
          <p className="mt-2 text-sm text-slate-200">
            {scanMessage ?? scanInfo?.helper ?? "Save the build details to trigger malware scanning."}
          </p>
          {lastScannedAt ? (
            <p className="mt-2 text-xs text-slate-500">Last scanned: {lastScannedAt}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          Save your draft first to unlock build uploads and automated malware scanning.
        </p>
      )}
    </div>
  );
}

interface FormFeedbackProps {
  message: string | null;
  state: "error" | "success" | "idle" | "submitting";
  draftSlug: string | null;
  draftStatus: string | null;
}

export function FormFeedback({
  message,
  state,
  draftSlug,
  draftStatus,
}: FormFeedbackProps): JSX.Element | null {
  if (!message && !draftSlug) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3 text-sm">
      {message ? (
        <p className={state === "error" ? "text-rose-300" : "text-emerald-200"}>{message}</p>
      ) : null}
      {draftSlug ? (
        <p className="text-xs text-slate-400">
          Draft saved as <span className="font-mono text-slate-200">{draftSlug}</span>. Status: {draftStatus ?? "UNKNOWN"}.
        </p>
      ) : null}
    </div>
  );
}

export function Section({ children }: PropsWithChildren): JSX.Element {
  return <div className="space-y-4">{children}</div>;
}
