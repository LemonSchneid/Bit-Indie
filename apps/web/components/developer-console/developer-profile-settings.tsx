"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  getDeveloperProfile,
  updateDeveloperProfile,
  type DeveloperProfile,
  type UserProfile,
} from "../../lib/api";

const labelClass = "block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400";
const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 focus:border-emerald-400 focus:outline-none";
const helperTextClass = "mt-1 text-xs text-slate-400";

function normalizeValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type FormStatus = "idle" | "loading" | "saving" | "success" | "error";

interface DeveloperProfileSettingsProps {
  user: UserProfile;
}

/**
 * Display and update the developer profile contact settings for the signed-in user.
 */
export function DeveloperProfileSettings({ user }: DeveloperProfileSettingsProps): JSX.Element {
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [contactEmail, setContactEmail] = useState<string>("");
  const [profileUrl, setProfileUrl] = useState<string>("");
  const [status, setStatus] = useState<FormStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setMessage(null);

    void (async () => {
      try {
        const existing = await getDeveloperProfile(user.id);
        if (cancelled) {
          return;
        }
        setProfile(existing);
        setContactEmail(existing.contact_email ?? "");
        setProfileUrl(existing.profile_url ?? "");
        setStatus("idle");
        setMessage(null);
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        if (error instanceof Error && error.message === "Developer profile not found.") {
          setProfile(null);
          setContactEmail("");
          setProfileUrl("");
          setStatus("idle");
          setMessage("Enable developer tools to publish your contact details.");
        } else if (error instanceof Error) {
          setStatus("error");
          setMessage(error.message);
        } else {
          setStatus("error");
          setMessage("Unable to load developer profile.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const isBusy = status === "loading" || status === "saving";
  const buttonLabel = status === "saving" ? "Saving…" : "Save profile";
  const messageClass = useMemo(() => {
    if (!message) {
      return "";
    }
    if (status === "error") {
      return "text-xs text-rose-200";
    }
    if (status === "success") {
      return "text-xs text-emerald-200";
    }
    return "text-xs text-slate-400";
  }, [message, status]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (status === "saving") {
        return;
      }

      setStatus("saving");
      setMessage(null);

      try {
        const updated = await updateDeveloperProfile(user.id, {
          contact_email: normalizeValue(contactEmail),
          profile_url: normalizeValue(profileUrl),
        });
        setProfile(updated);
        setContactEmail(updated.contact_email ?? "");
        setProfileUrl(updated.profile_url ?? "");
        setStatus("success");
        setMessage("Developer profile saved.");
      } catch (error: unknown) {
        setStatus("error");
        if (error instanceof Error) {
          setMessage(error.message);
        } else {
          setMessage("Unable to update developer profile.");
        }
      }
    },
    [contactEmail, profileUrl, status, user.id],
  );

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Developer profile</h2>
        <p className="text-sm text-slate-300">
          Share a support email and optional studio URL so players and partners can reach you.
        </p>
      </header>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="developer-contact-email" className={labelClass}>
            Support contact email
          </label>
          <input
            id="developer-contact-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className={inputClass}
            placeholder="you@example.com"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            disabled={isBusy}
          />
          <p className={helperTextClass}>Visible to players after you publish a build.</p>
        </div>

        <div>
          <label htmlFor="developer-profile-url" className={labelClass}>
            Studio or support URL
          </label>
          <input
            id="developer-profile-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            className={inputClass}
            placeholder="https://studio.example.com"
            value={profileUrl}
            onChange={(event) => setProfileUrl(event.target.value)}
            disabled={isBusy}
          />
          <p className={helperTextClass}>Optional link to your studio page or community hub.</p>
        </div>

        <button
          type="submit"
          disabled={isBusy}
          className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {buttonLabel}
        </button>
      </form>

      {message ? <p className={messageClass}>{message}</p> : null}

      {profile?.verified_dev ? (
        <p className="text-xs text-emerald-200">This profile is verified for Bit Indie launches.</p>
      ) : null}
    </section>
  );
}
