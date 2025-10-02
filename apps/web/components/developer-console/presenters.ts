import type { GamePublishChecklist } from "../../lib/api";

export type AssetKind = "cover" | "hero" | "receipt" | "build";

export type AssetUploadStatus = "idle" | "uploading" | "success" | "error";

export interface AssetUploadState {
  status: AssetUploadStatus;
  message: string | null;
}

export type ChecklistState = "idle" | "loading" | "success" | "error";

export interface ChecklistDescriptor {
  message: string;
  tone: "info" | "success" | "error";
}

export interface AssetUploadDescriptor {
  message: string;
  tone: "info" | "success" | "error" | "default";
}

const DEFAULT_UPLOAD_MESSAGES: Record<AssetKind, string> = {
  cover: "Upload a cover image to refresh your catalog tile.",
  hero: "Upload a cinematic hero image for the game page.",
  receipt: "Upload a receipt thumbnail so buyers can recognize the download.",
  build: "Upload a build archive to unlock purchases and downloads.",
};

export function describeAssetUpload(
  kind: AssetKind,
  state: AssetUploadState,
): AssetUploadDescriptor {
  const baseMessage = state.message ?? DEFAULT_UPLOAD_MESSAGES[kind];

  switch (state.status) {
    case "uploading":
      return { message: baseMessage, tone: "info" };
    case "success":
      return { message: baseMessage, tone: "success" };
    case "error":
      return { message: baseMessage, tone: "error" };
    default:
      return { message: baseMessage, tone: "default" };
  }
}

export function describeChecklistState({
  state,
  error,
  checklist,
}: {
  state: ChecklistState;
  error: string | null;
  checklist: GamePublishChecklist | null;
}): ChecklistDescriptor {
  if (state === "loading") {
    return {
      tone: "info",
      message: "Checking publish readiness…",
    };
  }

  if (state === "error" && error) {
    return {
      tone: "error",
      message: error,
    };
  }

  if (!checklist) {
    return {
      tone: "info",
      message: "Save a draft to view publish requirements.",
    };
  }

  if (checklist.is_publish_ready) {
    return {
      tone: "success",
      message: "All publish requirements are satisfied. You can promote this game now.",
    };
  }

  if (checklist.missing_requirements.length === 0) {
    return {
      tone: "info",
      message: "Keep your draft up to date to unlock the publish action.",
    };
  }

  const missing = checklist.missing_requirements.map((item) => item.message).join(" ");
  return {
    tone: "info",
    message:
      missing ||
      "Add a summary, description, cover image, and build upload before publishing.",
  };
}
