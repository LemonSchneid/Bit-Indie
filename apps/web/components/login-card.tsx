"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LoginSuccessResponse,
  SignedEvent,
  UserProfile,
  becomeDeveloper,
  requestLoginChallenge,
  verifyLoginEvent,
} from "../lib/api";
import { loadStoredUserProfile, saveUserProfile } from "../lib/user-storage";
import { GameDraftForm } from "./game-draft-form";

type LoginState = "idle" | "pending" | "success" | "error";

const LOGIN_KIND = 22242;

type NostrUnsignedEvent = {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
};

interface NostrSigner {
  signEvent: (event: NostrUnsignedEvent) => Promise<SignedEvent>;
}

declare global {
  interface Window {
    nostr?: NostrSigner;
  }
}

function formatPubkey(pubkey: string): string {
  if (pubkey.length <= 12) {
    return pubkey;
  }

  const prefix = pubkey.slice(0, 8);
  const suffix = pubkey.slice(-8);
  return `${prefix}…${suffix}`;
}

export function LoginCard(): JSX.Element {
  const [hasSigner, setHasSigner] = useState(false);
  const [state, setState] = useState<LoginState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => loadStoredUserProfile());
  const [developerState, setDeveloperState] = useState<LoginState>(() =>
    profile?.is_developer ? "success" : "idle",
  );
  const [developerMessage, setDeveloperMessage] = useState<string | null>(() =>
    profile?.is_developer ? "Your account is now registered as a developer." : null,
  );

  useEffect(() => {
    const signerAvailable = typeof window !== "undefined" && Boolean(window.nostr?.signEvent);
    setHasSigner(signerAvailable);
  }, []);

  const buttonLabel = useMemo(() => {
    if (!hasSigner) {
      return "Install a Nostr signer";
    }
    if (state === "pending") {
      return "Waiting for signature";
    }
    return profile ? "Reconnect" : "Sign in with Nostr";
  }, [hasSigner, state, profile]);

  const handleLogin = useCallback(async () => {
    if (state === "pending") {
      return;
    }

    if (typeof window === "undefined" || !window.nostr?.signEvent) {
      setHasSigner(false);
      setState("error");
      setMessage("A NIP-07 compatible browser extension is required to sign in.");
      return;
    }

    setState("pending");
    setMessage(null);

    try {
      const challenge = await requestLoginChallenge();
      const unsignedEvent: NostrUnsignedEvent = {
        kind: LOGIN_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["challenge", challenge.challenge],
          ["client", "proof-of-play-web"],
        ],
        content: "Proof of Play login",
      };

      const signedEvent = await window.nostr.signEvent(unsignedEvent);
      const response: LoginSuccessResponse = await verifyLoginEvent(signedEvent);

      setProfile(response.user);
      saveUserProfile(response.user);
      if (response.user.is_developer) {
        setDeveloperState("success");
        setDeveloperMessage("Your account is now registered as a developer.");
      } else {
        setDeveloperState("idle");
        setDeveloperMessage(null);
      }
      setState("success");
      setMessage("Your Nostr identity is linked to Proof of Play.");
    } catch (error: unknown) {
      setState("error");
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Login failed due to an unexpected error.");
      }
    }
  }, [state]);

  const handleBecomeDeveloper = useCallback(async () => {
    if (!profile) {
      setDeveloperState("error");
      setDeveloperMessage("Sign in before creating a developer profile.");
      return;
    }

    if (developerState === "pending") {
      return;
    }

    setDeveloperState("pending");
    setDeveloperMessage(null);

    try {
      await becomeDeveloper({ user_id: profile.id });
      const updatedProfile: UserProfile = { ...profile, is_developer: true };
      setProfile(updatedProfile);
      saveUserProfile(updatedProfile);
      setDeveloperState("success");
      setDeveloperMessage("Your account is now registered as a developer.");
    } catch (error: unknown) {
      setDeveloperState("error");
      if (error instanceof Error) {
        setDeveloperMessage(error.message);
      } else {
        setDeveloperMessage("Failed to create developer profile.");
      }
    }
  }, [profile, developerState]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Sign in</h3>
        <p className="mt-3 text-sm text-slate-300">
          Connect a NIP-07 browser signer to create or load your Proof of Play account using your Nostr public key.
        </p>

        {profile ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-4 text-sm text-emerald-200">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-emerald-100">Connected</p>
              {profile.is_developer ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                  Developer
                </span>
              ) : null}
            </div>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest">{formatPubkey(profile.pubkey_hex)}</p>
            {profile.is_developer ? (
              <p className="mt-4 text-xs text-emerald-100/80">
                Your Proof of Play account can publish and manage game listings.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleBecomeDeveloper}
                  disabled={developerState === "pending"}
                  className="mt-4 inline-flex items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {developerState === "pending" ? "Saving…" : "Become a developer"}
                </button>
                {developerMessage ? (
                  <p className={`mt-3 text-xs ${developerState === "error" ? "text-rose-200" : "text-emerald-100"}`}>
                    {developerMessage}
                  </p>
                ) : null}
              </>
            )}
            {profile.is_developer && developerMessage ? (
              <p className={`mt-3 text-xs ${developerState === "error" ? "text-rose-200" : "text-emerald-100"}`}>
                {developerMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <p className={`mt-4 text-sm ${state === "error" ? "text-rose-300" : "text-emerald-200"}`}>{message}</p>
        ) : null}

        {!hasSigner ? (
          <p className="mt-4 text-xs text-amber-200/80">
            Install a NIP-07 compatible wallet extension (e.g. Alby, nos2x) to enable signing directly from your browser.
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleLogin}
          disabled={!hasSigner || state === "pending"}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/60"
        >
          {buttonLabel}
        </button>
      </div>

      {profile?.is_developer ? <GameDraftForm user={profile} /> : null}
    </div>
  );
}

