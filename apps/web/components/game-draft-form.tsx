"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  CreateGameDraftRequest,
  GameCategory,
  GameDraft,
  UpdateGameDraftRequest,
  UserProfile,
  createGameDraft,
  updateGameDraft,
} from "../lib/api";

interface GameDraftFormProps {
  user: UserProfile;
}

type FormState = "idle" | "submitting" | "success" | "error";

type GameDraftFormValues = {
  title: string;
  slug: string;
  summary: string;
  description_md: string;
  price_msats: string;
  cover_url: string;
  trailer_url: string;
  category: GameCategory;
  build_object_key: string;
  build_size_bytes: string;
  checksum_sha256: string;
};

const categoryOptions: { value: GameCategory; label: string }[] = [
  { value: "PROTOTYPE", label: "Prototype" },
  { value: "EARLY_ACCESS", label: "Early access" },
  { value: "FINISHED", label: "Finished" },
];

type ScanStatus = GameDraft["build_scan_status"];

const scanStatusMeta: Record<ScanStatus, { label: string; badgeClass: string; helper: string }> = {
  NOT_SCANNED: {
    label: "Not scanned",
    badgeClass: "bg-slate-500/30 text-slate-200",
    helper: "Save your build details to trigger a malware scan.",
  },
  PENDING: {
    label: "Scanning",
    badgeClass: "bg-amber-400/20 text-amber-200",
    helper: "Malware scan in progress. Refresh this page for updates.",
  },
  CLEAN: {
    label: "Clean",
    badgeClass: "bg-emerald-400/20 text-emerald-200",
    helper: "No issues detected in the latest malware scan.",
  },
  INFECTED: {
    label: "Malware detected",
    badgeClass: "bg-rose-500/20 text-rose-200",
    helper: "Upload a clean build to continue. The last scan flagged malware.",
  },
  FAILED: {
    label: "Scan failed",
    badgeClass: "bg-amber-500/20 text-amber-200",
    helper: "Resolve the scan error and save the build again.",
  },
};

function createInitialValues(): GameDraftFormValues {
  return {
    title: "",
    slug: "",
    summary: "",
    description_md: "",
    price_msats: "",
    cover_url: "",
    trailer_url: "",
    category: "PROTOTYPE",
    build_object_key: "",
    build_size_bytes: "",
    checksum_sha256: "",
  };
}

function normalizeOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseOptionalNonNegativeInteger(value: string, fieldName: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return Math.trunc(numeric);
}

function normalizeChecksum(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.toLowerCase();
}

function buildCreatePayload(values: GameDraftFormValues, userId: string): CreateGameDraftRequest {
  return {
    user_id: userId,
    title: values.title.trim(),
    slug: values.slug.trim(),
    summary: normalizeOrNull(values.summary),
    description_md: normalizeOrNull(values.description_md),
    price_msats: parseOptionalNonNegativeInteger(values.price_msats, "Price"),
    cover_url: normalizeOrNull(values.cover_url),
    trailer_url: normalizeOrNull(values.trailer_url),
    category: values.category,
  };
}

function buildUpdatePayload(values: GameDraftFormValues, userId: string): UpdateGameDraftRequest {
  return {
    ...buildCreatePayload(values, userId),
    build_object_key: normalizeOrNull(values.build_object_key),
    build_size_bytes: parseOptionalNonNegativeInteger(values.build_size_bytes, "Build size"),
    checksum_sha256: normalizeChecksum(values.checksum_sha256),
  };
}

function mapDraftToValues(draft: GameDraft): GameDraftFormValues {
  return {
    title: draft.title,
    slug: draft.slug,
    summary: draft.summary ?? "",
    description_md: draft.description_md ?? "",
    price_msats: draft.price_msats != null ? String(draft.price_msats) : "",
    cover_url: draft.cover_url ?? "",
    trailer_url: draft.trailer_url ?? "",
    category: draft.category,
    build_object_key: draft.build_object_key ?? "",
    build_size_bytes: draft.build_size_bytes != null ? String(draft.build_size_bytes) : "",
    checksum_sha256: draft.checksum_sha256 ?? "",
  };
}

export function GameDraftForm({ user }: GameDraftFormProps): JSX.Element {
  const [values, setValues] = useState<GameDraftFormValues>(() => createInitialValues());
  const [draft, setDraft] = useState<GameDraft | null>(null);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setValues(createInitialValues());
    setDraft(null);
    setState("idle");
    setMessage(null);
  }, [user.id]);

  const buttonLabel = useMemo(() => {
    if (state === "submitting") {
      return "Saving…";
    }
    return draft ? "Update draft" : "Save draft";
  }, [draft, state]);

  const buildFieldsDisabled = useMemo(() => !draft || state === "submitting", [draft, state]);
  const scanInfo = useMemo(() => (draft ? scanStatusMeta[draft.build_scan_status] : null), [draft]);
  const lastScannedAt = useMemo(() => {
    if (!draft?.build_scanned_at) {
      return null;
    }
    const parsed = new Date(draft.build_scanned_at);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString();
  }, [draft?.build_scanned_at]);

  const handleFieldChange = useCallback((field: keyof GameDraftFormValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (state === "submitting") {
        return;
      }

      setState("submitting");
      setMessage(null);

      try {
        let savedDraft: GameDraft;
        if (draft) {
          const updatePayload: UpdateGameDraftRequest = buildUpdatePayload(values, user.id);
          savedDraft = await updateGameDraft(draft.id, updatePayload);
        } else {
          const createPayload = buildCreatePayload(values, user.id);
          savedDraft = await createGameDraft(createPayload);
        }

        setDraft(savedDraft);
        setValues(mapDraftToValues(savedDraft));
        setState("success");
        setMessage(draft ? "Game draft updated." : "Game draft saved.");
      } catch (error: unknown) {
        setState("error");
        if (error instanceof Error) {
          setMessage(error.message);
        } else {
          setMessage("Unable to save your game draft.");
        }
      }
    },
    [draft, state, user.id, values],
  );

  const handleStartNewDraft = useCallback(() => {
    setDraft(null);
    setValues(createInitialValues());
    setState("idle");
    setMessage(null);
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            {draft ? "Update your game draft" : "Create a game draft"}
          </h3>
          <p className="mt-3 text-sm text-slate-300">
            Save progress on an UNLISTED game listing. You can revisit and update the draft as you iterate on your build.
          </p>
        </div>
        {draft ? (
          <button
            type="button"
            onClick={handleStartNewDraft}
            className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:bg-emerald-400/20"
          >
            Start new draft
          </button>
        ) : null}
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="draft-title" className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Title
          </label>
          <input
            id="draft-title"
            name="title"
            value={values.title}
            onChange={(event) => handleFieldChange("title", event.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none"
            placeholder="Enter a working title"
          />
        </div>

        <div>
          <label htmlFor="draft-slug" className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Slug
          </label>
          <input
            id="draft-slug"
            name="slug"
            value={values.slug}
            onChange={(event) => handleFieldChange("slug", event.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-sm uppercase tracking-widest text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none"
            placeholder="my-cyber-adventure"
          />
          <p className="mt-1 text-xs text-slate-400">Slugs are lower-case and appear in the public URL for your game.</p>
        </div>

        <div>
          <label htmlFor="draft-summary" className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Summary
          </label>
          <textarea
            id="draft-summary"
            name="summary"
            value={values.summary}
            onChange={(event) => handleFieldChange("summary", event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none"
            placeholder="Give players a one-sentence pitch."
          />
          <p className="mt-1 text-xs text-slate-400">Summaries are optional and limited to 280 characters.</p>
        </div>

        <div>
          <label htmlFor="draft-description" className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Description (Markdown)
          </label>
          <textarea
            id="draft-description"
            name="description"
            value={values.description_md}
            onChange={(event) => handleFieldChange("description_md", event.target.value)}
            rows={6}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none"
            placeholder="Expand on your game mechanics, inspiration, and development roadmap."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="draft-price" className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Price (millisats)
            </label>
            <input
              id="draft-price"
              name="price"
              value={values.price_msats}
              onChange={(event) => handleFieldChange("price_msats", event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none"
              placeholder="Leave blank for free downloads"
            />
          </div>

          <div>
            <label htmlFor="draft-category" className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Category
            </label>
            <select
              id="draft-category"
              name="category"
              value={values.category}
              onChange={(event) => handleFieldChange("category", event.target.value as GameCategory)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="draft-cover" className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Cover image URL
            </label>
            <input
              id="draft-cover"
              name="cover"
              value={values.cover_url}
              onChange={(event) => handleFieldChange("cover_url", event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none"
              placeholder="https://cdn.example.com/cover.png"
            />
          </div>
          <div>
            <label htmlFor="draft-trailer" className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Trailer URL
            </label>
            <input
              id="draft-trailer"
              name="trailer"
              value={values.trailer_url}
              onChange={(event) => handleFieldChange("trailer_url", event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none"
              placeholder="https://video.example.com/trailer.mp4"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Build submission</h4>
              <p className="mt-1 text-xs text-slate-400">
                Upload your build to storage, then record the object key, file size, and checksum so we can scan it.
              </p>
            </div>
            {draft ? (
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${scanInfo?.badgeClass ?? "bg-slate-500/30 text-slate-200"}`}
              >
                {scanInfo?.label ?? "Not scanned"}
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="draft-build-key"
                className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400"
              >
                Build object key
              </label>
              <input
                id="draft-build-key"
                name="build_object_key"
                value={values.build_object_key}
                onChange={(event) => handleFieldChange("build_object_key", event.target.value)}
                disabled={buildFieldsDisabled}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                placeholder={draft ? `games/${draft.id}/build/v1.0.0.zip` : "games/<id>/build/v1.0.0.zip"}
              />
              <p className="mt-1 text-xs text-slate-500">Use the exact key returned by the upload API.</p>
            </div>
            <div>
              <label
                htmlFor="draft-build-size"
                className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400"
              >
                Build size (bytes)
              </label>
              <input
                id="draft-build-size"
                name="build_size_bytes"
                value={values.build_size_bytes}
                onChange={(event) => handleFieldChange("build_size_bytes", event.target.value)}
                disabled={buildFieldsDisabled}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="734003200"
              />
              <p className="mt-1 text-xs text-slate-500">Record the exact byte size after compression.</p>
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="draft-checksum"
              className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400"
            >
              SHA-256 checksum
            </label>
            <input
              id="draft-checksum"
              name="checksum_sha256"
              value={values.checksum_sha256}
              onChange={(event) => handleFieldChange("checksum_sha256", event.target.value)}
              disabled={buildFieldsDisabled}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-xs uppercase tracking-widest text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="64-character hex digest"
            />
          </div>

          {draft ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Malware scan</p>
              <p className="mt-2 text-sm text-slate-200">
                {draft.build_scan_message ?? scanInfo?.helper ?? "Save the build details to trigger malware scanning."}
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

        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex w-full items-center justify-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/60"
        >
          {buttonLabel}
        </button>
      </form>

      {message ? (
        <p className={`mt-4 text-sm ${state === "error" ? "text-rose-300" : "text-emerald-200"}`}>{message}</p>
      ) : null}

      {draft ? (
        <p className="mt-3 text-xs text-slate-400">
          Draft saved as <span className="font-mono text-slate-200">{draft.slug}</span>. Status: {draft.status}.
        </p>
      ) : null}
    </div>
  );
}
