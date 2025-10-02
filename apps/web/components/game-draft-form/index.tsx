"use client";

import { useEffect, useMemo } from "react";

import { type GameCategory, type GameDraft, type UserProfile } from "../../lib/api";
import {
  DraftInputField,
  DraftSelectField,
  DraftTextareaField,
  LightningAddressField,
} from "./fields";
import { BuildMetadataSection, FormFeedback, GameDraftFormHeader, Section } from "./sections";
import { useGameDraftForm } from "./use-game-draft-form";
import type { GameDraftFormValues } from "./form-utils";

interface GameDraftFormProps {
  user: UserProfile;
  onUserUpdate?: (user: UserProfile) => void;
  initialDraft?: GameDraft | null;
  onDraftChange?: (draft: GameDraft | null) => void;
  onFormApi?: (api: GameDraftFormApi) => void;
}

export interface GameDraftFormApi {
  getDraft: () => GameDraft | null;
  applyFormValues: (fields: Partial<GameDraftFormValues>) => void;
  replaceDraft: (draft: GameDraft | null) => void;
}

const categoryOptions: { value: GameCategory; label: string }[] = [
  { value: "PROTOTYPE", label: "Prototype" },
  { value: "EARLY_ACCESS", label: "Early access" },
  { value: "FINISHED", label: "Finished" },
];

export function GameDraftForm({
  user,
  onUserUpdate,
  initialDraft = null,
  onDraftChange,
  onFormApi,
}: GameDraftFormProps): JSX.Element {
  const {
    values,
    draft,
    state,
    message,
    buttonLabel,
    buildFieldsDisabled,
    scanInfo,
    lastScannedAt,
    lightningAddress,
    handleFieldChange,
    handleLightningAddressChange,
    handleSubmit,
    handleStartNewDraft,
    applyFormValues,
    replaceDraft,
  } = useGameDraftForm({
    user,
    onUserUpdate,
    initialDraft,
    onDraftChange,
  });

  const formApi = useMemo<GameDraftFormApi>(
    () => ({
      getDraft: () => draft,
      applyFormValues,
      replaceDraft,
    }),
    [applyFormValues, draft, replaceDraft],
  );

  useEffect(() => {
    if (typeof onFormApi === "function") {
      onFormApi(formApi);
    }
  }, [formApi, onFormApi]);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
      <GameDraftFormHeader hasDraft={Boolean(draft)} onStartNewDraft={handleStartNewDraft} />

      <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
        <Section>
          <DraftInputField
            id="draft-title"
            name="title"
            label="Title"
            value={values.title}
            placeholder="Enter a working title"
            required
            onValueChange={(value) => handleFieldChange("title", value)}
          />

          <DraftInputField
            id="draft-slug"
            name="slug"
            label="Slug"
            value={values.slug}
            placeholder="my-cyber-adventure"
            required
            className="font-mono text-sm uppercase tracking-widest"
            helperText="Slugs are lower-case and appear in the public URL for your game."
            onValueChange={(value) => handleFieldChange("slug", value)}
          />

          <LightningAddressField
            id="developer-lightning-address"
            name="lightning_address"
            value={lightningAddress}
            placeholder="dev@wallet.example.com"
            required
            onValueChange={handleLightningAddressChange}
          />
        </Section>

        <Section>
          <DraftTextareaField
            id="draft-summary"
            name="summary"
            label="Summary"
            value={values.summary}
            rows={3}
            placeholder="Give players a one-sentence pitch."
            helperText="Summaries are optional and limited to 280 characters."
            onValueChange={(value) => handleFieldChange("summary", value)}
          />

          <DraftTextareaField
            id="draft-description"
            name="description"
            label="Description (Markdown)"
            value={values.description_md}
            rows={6}
            placeholder="Expand on your game mechanics, inspiration, and development roadmap."
            onValueChange={(value) => handleFieldChange("description_md", value)}
          />
        </Section>

        <Section>
          <div className="grid gap-4 sm:grid-cols-2">
            <DraftInputField
              id="draft-price"
              name="price"
              label="Price (millisats)"
              value={values.price_msats}
              placeholder="Leave blank for free downloads"
              onValueChange={(value) => handleFieldChange("price_msats", value)}
            />

            <DraftSelectField
              id="draft-category"
              name="category"
              label="Category"
              value={values.category}
              onValueChange={(value) => handleFieldChange("category", value as GameCategory)}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </DraftSelectField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DraftInputField
              id="draft-cover"
              name="cover"
              label="Cover image URL"
              value={values.cover_url}
              placeholder="https://cdn.example.com/cover.png"
              onValueChange={(value) => handleFieldChange("cover_url", value)}
            />
            <DraftInputField
              id="draft-hero"
              name="hero"
              label="Hero image URL"
              value={values.hero_url}
              placeholder="https://cdn.example.com/hero.jpg"
              onValueChange={(value) => handleFieldChange("hero_url", value)}
            />
            <DraftInputField
              id="draft-receipt"
              name="receipt"
              label="Receipt thumbnail URL"
              value={values.receipt_thumbnail_url}
              placeholder="https://cdn.example.com/receipt.png"
              onValueChange={(value) => handleFieldChange("receipt_thumbnail_url", value)}
            />
            <DraftInputField
              id="draft-trailer"
              name="trailer"
              label="Trailer URL"
              value={values.trailer_url}
              placeholder="https://video.example.com/trailer.mp4"
              onValueChange={(value) => handleFieldChange("trailer_url", value)}
            />
          </div>
        </Section>

        <BuildMetadataSection
          values={{
            build_object_key: values.build_object_key,
            build_size_bytes: values.build_size_bytes,
            checksum_sha256: values.checksum_sha256,
          }}
          disabled={buildFieldsDisabled}
          draftId={draft?.id ?? null}
          scanInfo={scanInfo}
          scanMessage={draft?.build_scan_message ?? null}
          lastScannedAt={lastScannedAt}
          onFieldChange={handleFieldChange}
        />

        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex w-full items-center justify-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/60"
        >
          {buttonLabel}
        </button>
      </form>

      <FormFeedback
        message={message}
        state={state}
        draftSlug={draft?.slug ?? null}
        draftStatus={draft?.status ?? null}
      />
    </div>
  );
}

export type { GameDraftFormProps };
export type { GameDraftFormValues } from "./form-utils";
