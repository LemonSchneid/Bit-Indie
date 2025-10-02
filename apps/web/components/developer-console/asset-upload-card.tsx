"use client";

import { useRef, type ChangeEventHandler } from "react";

import { describeAssetUpload, type AssetKind, type AssetUploadState } from "./presenters";

interface AssetUploadCardProps {
  kind: AssetKind;
  state: AssetUploadState;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}

const TITLES: Record<AssetKind, string> = {
  cover: "Cover image upload",
  build: "Build upload",
};

const DESCRIPTIONS: Record<AssetKind, string> = {
  cover: "Choose a PNG or JPG under 5 MB. We optimize the image for the catalog tile automatically.",
  build: "Upload a ZIP archive containing your executable or HTML build. We will compute the checksum and trigger a malware scan.",
};

const ACCEPT: Record<AssetKind, string> = {
  cover: "image/png,image/jpeg",
  build: ".zip",
};

export function AssetUploadCard({ kind, state, disabled = false, onFileSelected }: AssetUploadCardProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const descriptor = describeAssetUpload(kind, state);

  const handlePickFile = () => {
    if (disabled) {
      return;
    }
    inputRef.current?.click();
  };

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    onFileSelected(file);
    event.target.value = "";
  };

  const toneClass =
    descriptor.tone === "success"
      ? "text-emerald-200"
      : descriptor.tone === "error"
        ? "text-rose-200"
        : descriptor.tone === "info"
          ? "text-slate-300"
          : "text-slate-400";

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold text-white">{TITLES[kind]}</h3>
        <p className="text-sm text-slate-300">{DESCRIPTIONS[kind]}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePickFile}
          disabled={disabled || state.status === "uploading"}
          className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.status === "uploading" ? "Uploading…" : "Select file"}
        </button>
        <span className={`text-xs ${toneClass}`}>{descriptor.message}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="hidden"
        onChange={handleChange}
        disabled={disabled || state.status === "uploading"}
      />
    </section>
  );
}
