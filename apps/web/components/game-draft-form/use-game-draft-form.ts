"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  type GameDraft,
  type UserProfile,
  createGameDraft,
  updateGameDraft,
  updateUserLightningAddress,
} from "../../lib/api";
import {
  buildCreatePayload,
  buildUpdatePayload,
  createInitialValues,
  mapDraftToValues,
  type GameDraftFormValues,
} from "./form-utils";
import { getScanStatusDisplay, type ScanStatusDisplay } from "./scan-metadata";

export type FormState = "idle" | "submitting" | "success" | "error";

interface UseGameDraftFormOptions {
  user: UserProfile;
  onUserUpdate?: (user: UserProfile) => void;
  initialDraft?: GameDraft | null;
  onDraftChange?: (draft: GameDraft | null) => void;
}

interface UseGameDraftFormResult {
  values: GameDraftFormValues;
  draft: GameDraft | null;
  state: FormState;
  message: string | null;
  buttonLabel: string;
  buildFieldsDisabled: boolean;
  scanInfo: ScanStatusDisplay | null;
  lastScannedAt: string | null;
  lightningAddress: string;
  handleFieldChange: (field: keyof GameDraftFormValues, value: string) => void;
  handleLightningAddressChange: (value: string) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleStartNewDraft: () => void;
  applyFormValues: (fields: Partial<GameDraftFormValues>) => void;
  replaceDraft: (draft: GameDraft | null) => void;
}

/**
 * Manage the state transitions and submission workflow for the game draft form.
 */
export function useGameDraftForm({
  user,
  onUserUpdate,
  initialDraft = null,
  onDraftChange,
}: UseGameDraftFormOptions): UseGameDraftFormResult {
  const [values, setValues] = useState<GameDraftFormValues>(() => createInitialValues());
  const [draft, setDraft] = useState<GameDraft | null>(null);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [lightningAddress, setLightningAddress] = useState<string>(
    user.lightning_address ?? "",
  );

  useEffect(() => {
    setValues(createInitialValues());
    setDraft(null);
    setState("idle");
    setMessage(null);
    setLightningAddress(user.lightning_address ?? "");
  }, [user.id, user.lightning_address]);

  useEffect(() => {
    if (!initialDraft && !draft) {
      return;
    }

    if (!initialDraft) {
      setDraft(null);
      setValues(createInitialValues());
      setState("idle");
      setMessage(null);
      return;
    }

    if (draft && draft.id === initialDraft.id && draft.updated_at === initialDraft.updated_at) {
      return;
    }

    setDraft(initialDraft);
    setValues(mapDraftToValues(initialDraft));
    setState("idle");
    setMessage(null);
  }, [draft, initialDraft]);

  useEffect(() => {
    if (typeof onDraftChange === "function") {
      onDraftChange(draft);
    }
  }, [draft, onDraftChange]);

  const buttonLabel = useMemo(() => {
    if (state === "submitting") {
      return "Saving…";
    }
    return draft ? "Update draft" : "Save draft";
  }, [draft, state]);

  const buildFieldsDisabled = useMemo(
    () => !draft || state === "submitting",
    [draft, state],
  );

  const scanInfo = useMemo(() => {
    if (!draft) {
      return null;
    }
    return getScanStatusDisplay(draft.build_scan_status);
  }, [draft]);

  const lastScannedAt = useMemo(() => {
    if (!draft?.build_scanned_at) {
      return null;
    }
    const parsed = new Date(draft.build_scanned_at);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString("en-US");
  }, [draft?.build_scanned_at]);

  const handleFieldChange = useCallback(
    (field: keyof GameDraftFormValues, value: string) => {
      setValues((previous) => ({ ...previous, [field]: value }));
    },
    [],
  );

  const handleLightningAddressChange = useCallback((value: string) => {
    setLightningAddress(value);
  }, []);

  const applyFormValues = useCallback(
    (fields: Partial<GameDraftFormValues>) => {
      setValues((previous) => ({ ...previous, ...fields }));
    },
    [],
  );

  const replaceDraft = useCallback(
    (nextDraft: GameDraft | null) => {
      setDraft(nextDraft);
      if (nextDraft) {
        setValues(mapDraftToValues(nextDraft));
      } else {
        setValues(createInitialValues());
      }
      setState("idle");
      setMessage(null);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (state === "submitting") {
        return;
      }

      setState("submitting");
      setMessage(null);

      try {
        const normalizedLightning = lightningAddress.trim();
        if (!normalizedLightning) {
          setState("error");
          setMessage("Add a Lightning address to receive payouts from your game.");
          return;
        }

        const currentLightning = (user.lightning_address ?? "").trim();
        if (normalizedLightning !== currentLightning) {
          const updatedUser = await updateUserLightningAddress(user.id, normalizedLightning);
          setLightningAddress(updatedUser.lightning_address ?? "");
          if (typeof onUserUpdate === "function") {
            onUserUpdate(updatedUser);
          }
        }

        let savedDraft: GameDraft;
        if (draft) {
          const updatePayload = buildUpdatePayload(values, user.id);
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
    [draft, lightningAddress, onUserUpdate, state, user.id, user.lightning_address, values],
  );

  const handleStartNewDraft = useCallback(() => {
    setDraft(null);
    setValues(createInitialValues());
    setState("idle");
    setMessage(null);
  }, []);

  return {
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
  };
}
