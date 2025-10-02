"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  GameDraftForm,
  type GameDraftFormApi,
} from "../game-draft-form";
import {
  type GameDraft,
  type GamePublishChecklist,
  type UserProfile,
  becomeDeveloper,
  createGameAssetUpload,
  getGamePublishChecklist,
  publishGame,
  updateGameDraft,
} from "../../lib/api";
import { useStoredUserProfile } from "../../lib/hooks/use-stored-user-profile";
import { computeSha256Hex } from "../../lib/files";
import { performPresignedUpload } from "../../lib/uploads";
import { saveUserProfile } from "../../lib/user-storage";
import { AssetUploadCard } from "./asset-upload-card";
import {
  type AssetKind,
  type AssetUploadState,
  type ChecklistState,
} from "./presenters";
import {
  PublishChecklistCard,
  type PublishActionState,
} from "./publish-checklist-card";

const EMPTY_ASSET_STATE: AssetUploadState = { status: "idle", message: null };

function createInitialAssetStates(): Record<AssetKind, AssetUploadState> {
  return {
    cover: { ...EMPTY_ASSET_STATE },
    build: { ...EMPTY_ASSET_STATE },
  };
}

const ADMIN_LINK_CLASS =
  "inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:text-white hover:border-white/40";

export function DeveloperDashboard(): JSX.Element {
  const storedProfile = useStoredUserProfile();
  const [profile, setProfile] = useState<UserProfile | null>(storedProfile);
  const [formApi, setFormApi] = useState<GameDraftFormApi | null>(null);
  const [currentDraft, setCurrentDraft] = useState<GameDraft | null>(null);
  const [checklist, setChecklist] = useState<GamePublishChecklist | null>(null);
  const [checklistState, setChecklistState] = useState<ChecklistState>("idle");
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<PublishActionState>({
    status: "idle",
    message: null,
  });
  const [assetStates, setAssetStates] = useState<Record<AssetKind, AssetUploadState>>(
    () => createInitialAssetStates(),
  );
  const [developerState, setDeveloperState] = useState<PublishActionState>({
    status: "idle",
    message: null,
  });

  useEffect(() => {
    setProfile(storedProfile);
  }, [storedProfile]);

  const handleUserUpdate = useCallback((user: UserProfile) => {
    saveUserProfile(user);
    setProfile(user);
  }, []);

  const handleFormApi = useCallback((api: GameDraftFormApi) => {
    setFormApi(api);
  }, []);

  const handleDraftChange = useCallback((draft: GameDraft | null) => {
    setCurrentDraft(draft);
  }, []);

  const updateAssetState = useCallback((kind: AssetKind, update: AssetUploadState) => {
    setAssetStates((previous) => ({ ...previous, [kind]: update }));
  }, []);

  const resetAssetStates = useCallback(() => {
    setAssetStates(createInitialAssetStates());
  }, []);

  const refreshChecklist = useCallback(async () => {
    if (!profile || !profile.is_admin || !currentDraft) {
      setChecklist(null);
      setChecklistState("idle");
      setChecklistError(null);
      return;
    }

    setChecklistState("loading");
    setChecklistError(null);
    try {
      const data = await getGamePublishChecklist(currentDraft.id, profile.id);
      setChecklist(data);
      setChecklistState("success");
    } catch (error: unknown) {
      setChecklistState("error");
      if (error instanceof Error) {
        setChecklistError(error.message);
      } else {
        setChecklistError("Unable to load publish requirements.");
      }
    }
  }, [currentDraft, profile]);

  useEffect(() => {
    if (!currentDraft) {
      setChecklist(null);
      setChecklistState("idle");
      setChecklistError(null);
      resetAssetStates();
      return;
    }

    void refreshChecklist();
  }, [currentDraft, refreshChecklist, resetAssetStates]);

  const handleUpload = useCallback(
    async (kind: AssetKind, file: File) => {
      if (!profile || !profile.is_admin) {
        updateAssetState(kind, {
          status: "error",
          message: "Sign in with an admin account before uploading assets.",
        });
        return;
      }

      const draft = formApi?.getDraft();
      if (!draft) {
        updateAssetState(kind, {
          status: "error",
          message: "Save your draft before uploading assets.",
        });
        return;
      }

      updateAssetState(kind, {
        status: "uploading",
        message:
          kind === "cover"
            ? "Uploading cover image…"
            : "Uploading build archive and computing checksum…",
      });

      try {
        const upload = await createGameAssetUpload(draft.id, kind, {
          user_id: profile.id,
          filename: file.name,
          content_type: file.type || undefined,
          max_bytes: file.size,
        });

        await performPresignedUpload(
          {
            uploadUrl: upload.upload_url,
            fields: upload.fields,
          },
          file,
        );

        const payload = kind === "cover"
          ? {
              user_id: profile.id,
              cover_url: upload.public_url,
            }
          : {
              user_id: profile.id,
              build_object_key: upload.object_key,
              build_size_bytes: file.size,
              checksum_sha256: await computeSha256Hex(file),
            };

        const updated = await updateGameDraft(draft.id, payload);
        formApi?.replaceDraft(updated);

        updateAssetState(kind, {
          status: "success",
          message:
            kind === "cover"
              ? "Cover uploaded and draft updated."
              : "Build uploaded, checksum recorded, and scan queued.",
        });
        setPublishState((prev) => ({
          status: prev.status === "success" ? prev.status : "idle",
          message: prev.status === "success" ? prev.message : null,
        }));
        await refreshChecklist();
      } catch (error: unknown) {
        updateAssetState(kind, {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to upload asset.",
        });
      }
    },
    [formApi, profile, refreshChecklist, updateAssetState],
  );

  const handlePublish = useCallback(async () => {
    if (!profile || !currentDraft) {
      setPublishState({
        status: "error",
        message: "Save your draft and ensure you are signed in as an admin to publish.",
      });
      return;
    }

    setPublishState({ status: "loading", message: "Publishing draft…" });
    try {
      const published = await publishGame(currentDraft.id, { user_id: profile.id });
      formApi?.replaceDraft(published);
      setPublishState({
        status: "success",
        message: "Draft promoted to the unlisted catalog.",
      });
      await refreshChecklist();
    } catch (error: unknown) {
      setPublishState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to publish draft.",
      });
    }
  }, [currentDraft, formApi, profile, refreshChecklist]);

  const handleBecomeDeveloper = useCallback(async () => {
    if (!profile) {
      return;
    }

    setDeveloperState({ status: "loading", message: "Enabling developer profile…" });
    try {
      await becomeDeveloper({ user_id: profile.id });
      const updated: UserProfile = { ...profile, is_developer: true };
      saveUserProfile(updated);
      setProfile(updated);
      setDeveloperState({
        status: "success",
        message: "Developer tools enabled for this account.",
      });
    } catch (error: unknown) {
      setDeveloperState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to enable developer tools.",
      });
    }
  }, [profile]);

  const quickLinks = useMemo(
    () => [
      { href: "/admin/mod", label: "Moderation queue" },
      { href: "/admin/stats", label: "Integrity metrics" },
    ],
    [],
  );

  if (!profile) {
    return (
      <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-white">Sign in required</h2>
        <p>Sign in with an administrator account to access the developer console.</p>
      </section>
    );
  }

  if (!profile.is_admin) {
    return (
      <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-white">Administrator access required</h2>
        <p>
          This console is limited to Bit Indie administrators. If you need access, contact the
          operations team.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
        <header className="space-y-2">
          <h2 className="text-lg font-semibold text-white">Admin quick links</h2>
          <p className="text-sm text-slate-300">
            Jump directly to moderation and integrity workspaces while your draft autosaves in the
            background.
          </p>
        </header>
        <div className="flex flex-wrap gap-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className={ADMIN_LINK_CLASS}>
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      {!profile.is_developer ? (
        <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
          <h2 className="text-lg font-semibold text-white">Enable developer tools</h2>
          <p>
            Create your developer profile to unlock drafting, asset uploads, and Lightning payouts.
          </p>
          <button
            type="button"
            onClick={handleBecomeDeveloper}
            disabled={developerState.status === "loading"}
            className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {developerState.status === "loading" ? "Enabling…" : "Enable developer profile"}
          </button>
          {developerState.message ? (
            <p
              className={`text-xs ${
                developerState.status === "error"
                  ? "text-rose-200"
                  : developerState.status === "success"
                    ? "text-emerald-200"
                    : "text-slate-400"
              }`}
            >
              {developerState.message}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          <GameDraftForm
            user={profile}
            onUserUpdate={handleUserUpdate}
            onFormApi={handleFormApi}
            onDraftChange={handleDraftChange}
          />

          <div className="space-y-6">
            <AssetUploadCard
              kind="cover"
              state={assetStates.cover}
              onFileSelected={(file) => void handleUpload("cover", file)}
              disabled={!currentDraft}
            />
            <AssetUploadCard
              kind="build"
              state={assetStates.build}
              onFileSelected={(file) => void handleUpload("build", file)}
              disabled={!currentDraft}
            />
          </div>
        </div>

        <div className="space-y-6">
          <PublishChecklistCard
            checklist={checklist}
            state={checklistState}
            error={checklistError}
            onRefresh={() => {
              void refreshChecklist();
            }}
            onPublish={() => {
              void handlePublish();
            }}
            publishState={publishState}
            disabled={!currentDraft}
          />
        </div>
      </div>
    </div>
  );
}
