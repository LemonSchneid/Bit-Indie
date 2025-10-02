"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { updateUserLightningAddress, type UserProfile } from "../../lib/api";

const labelClass = "block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400";
const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none";
const helperTextClass = "mt-1 text-xs text-slate-400";
const DEFAULT_STATUS_MESSAGE =
  "Lightning payouts settle to this address once your game is live. Provide a Lightning address (name@wallet.example) or LNURL.";

export type LightningFormStatus = "idle" | "saving" | "success" | "error";

export interface LightningStatusDescriptor {
  tone: "info" | "success" | "error";
  message: string;
}

export function normalizeLightningAddress(value: string): string {
  return value.trim();
}

export function describeLightningStatus(
  status: LightningFormStatus,
  message: string | null,
): LightningStatusDescriptor {
  if (status === "error" && message) {
    return { tone: "error", message };
  }

  if (status === "success" && message) {
    return { tone: "success", message };
  }

  if (message) {
    return { tone: "info", message };
  }

  return { tone: "info", message: DEFAULT_STATUS_MESSAGE };
}

interface DeveloperLightningSettingsProps {
  user: UserProfile;
  onUserUpdate?: (user: UserProfile) => void;
}

/**
 * Allow developers to manage the Lightning payout address for their studio account.
 */
export function DeveloperLightningSettings({
  user,
  onUserUpdate,
}: DeveloperLightningSettingsProps): JSX.Element {
  const [lightningAddress, setLightningAddress] = useState<string>(
    user.lightning_address ?? "",
  );
  const [status, setStatus] = useState<LightningFormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLightningAddress(user.lightning_address ?? "");
  }, [user.id, user.lightning_address]);

  const descriptor = useMemo(
    () => describeLightningStatus(status, message),
    [status, message],
  );

  const messageClass = useMemo(() => {
    switch (descriptor.tone) {
      case "success":
        return "text-xs text-emerald-200";
      case "error":
        return "text-xs text-rose-200";
      default:
        return "text-xs text-slate-400";
    }
  }, [descriptor.tone]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (status === "saving") {
        return;
      }

      const normalized = normalizeLightningAddress(lightningAddress);
      if (!normalized) {
        setStatus("error");
        setMessage("Enter a Lightning address to receive payouts.");
        return;
      }

      const current = normalizeLightningAddress(user.lightning_address ?? "");
      if (normalized === current) {
        setStatus("success");
        setMessage("Lightning address saved.");
        return;
      }

      setStatus("saving");
      setMessage(null);

      try {
        const updated = await updateUserLightningAddress(user.id, normalized);
        setStatus("success");
        setMessage("Lightning address saved.");
        setLightningAddress(updated.lightning_address ?? "");
        if (typeof onUserUpdate === "function") {
          onUserUpdate(updated);
        }
      } catch (error: unknown) {
        setStatus("error");
        if (error instanceof Error) {
          setMessage(error.message);
        } else {
          setMessage("Unable to update Lightning address.");
        }
      }
    },
    [lightningAddress, onUserUpdate, status, user.id, user.lightning_address],
  );

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Lightning payouts</h2>
        <p className="text-sm text-slate-300">
          Configure where Lightning purchases for your games are routed.
        </p>
      </header>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="developer-lightning-address" className={labelClass}>
            Lightning address or LNURL
          </label>
          <input
            id="developer-lightning-address"
            type="text"
            inputMode="email"
            autoComplete="off"
            className={inputClass}
            placeholder="dev@wallet.example.com"
            value={lightningAddress}
            onChange={(event) => setLightningAddress(event.target.value)}
            disabled={status === "saving"}
          />
          <p className={helperTextClass}>
            We recommend a custodial or self-hosted wallet that supports Lightning invoices.
          </p>
        </div>

        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save Lightning address"}
        </button>
      </form>

      <p className={messageClass}>{descriptor.message}</p>
    </section>
  );
}

