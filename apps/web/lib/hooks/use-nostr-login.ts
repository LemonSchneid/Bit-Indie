"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type LoginSuccessResponse,
  type SignedEvent,
  type UserProfile,
  requestLoginChallenge,
  verifyLoginEvent,
} from "../api";
import {
  USER_PROFILE_STORAGE_EVENT,
  USER_PROFILE_STORAGE_KEY,
  loadStoredSessionToken,
  loadStoredUserProfile,
  saveUserSession,
} from "../user-storage";
import { nostrEnabled } from "../flags";

export type NostrLoginState = "idle" | "pending" | "success" | "error";

const LOGIN_KIND = 22242;

export type NostrUnsignedEvent = {
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

type ExternalSigner = {
  signEvent: (event: NostrUnsignedEvent) => Promise<SignedEvent>;
};

type SignInOptions = {
  signer?: ExternalSigner;
};

export function useNostrLogin(): {
  hasSigner: boolean;
  state: NostrLoginState;
  message: string | null;
  profile: UserProfile | null;
  signIn: (options?: SignInOptions) => Promise<void>;
  resetFeedback: () => void;
  updateProfile: (nextProfile: UserProfile) => void;
} {
  const [hasSigner, setHasSigner] = useState(false);
  const [state, setState] = useState<NostrLoginState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => (nostrEnabled ? loadStoredUserProfile() : null));
  const [sessionToken, setSessionToken] = useState<string | null>(() => (nostrEnabled ? loadStoredSessionToken() : null));

  useEffect(() => {
    if (!nostrEnabled) {
      setHasSigner(false);
      return;
    }

    const signerAvailable = typeof window !== "undefined" && Boolean(window.nostr?.signEvent);
    setHasSigner(signerAvailable);
  }, []);

  useEffect(() => {
    if (!nostrEnabled || typeof window === "undefined") {
      return;
    }

    const refreshProfile = () => {
      setProfile(loadStoredUserProfile());
      setSessionToken(loadStoredSessionToken());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === USER_PROFILE_STORAGE_KEY) {
        refreshProfile();
      }
    };

    window.addEventListener(
      USER_PROFILE_STORAGE_EVENT,
      refreshProfile as EventListener,
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        USER_PROFILE_STORAGE_EVENT,
        refreshProfile as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const persistSession = useCallback((nextProfile: UserProfile, token: string | null) => {
    if (!nostrEnabled) {
      return;
    }
    setProfile(nextProfile);
    setSessionToken(token);
    saveUserSession(nextProfile, token);
  }, []);

  const updateProfile = useCallback(
    (nextProfile: UserProfile) => {
      if (!nostrEnabled) {
        return;
      }
      setProfile(nextProfile);
      saveUserSession(nextProfile, sessionToken);
    },
    [sessionToken],
  );

  const signIn = useCallback(async (options?: SignInOptions) => {
    if (!nostrEnabled) {
      setHasSigner(false);
      setState("error");
      setMessage("Sign-in is disabled for the Simple MVP. Use guest checkout instead.");
      return;
    }

    if (state === "pending") {
      return;
    }

    const signer: ExternalSigner | null = options?.signer
      ? options.signer
      : typeof window !== "undefined" && window.nostr?.signEvent
        ? { signEvent: window.nostr.signEvent }
        : null;

    if (!signer) {
      setHasSigner(false);
      setState("error");
      setMessage("A NIP-07 compatible browser extension or Nostr Connect signer is required to sign in.");
      return;
    }

    if (!options?.signer && typeof window !== "undefined") {
      setHasSigner(Boolean(window.nostr?.signEvent));
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
          ["client", "bit-indie-web"],
        ],
        content: "Bit Indie login",
      };

      const signedEvent = await signer.signEvent(unsignedEvent);
      const response: LoginSuccessResponse = await verifyLoginEvent(signedEvent);

      persistSession(response.user, response.session_token);
      setState("success");
      setMessage("Your Nostr identity is linked to Bit Indie.");
    } catch (error) {
      setState("error");
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Login failed due to an unexpected error.");
      }
    }
  }, [persistSession, state]);

  const resetFeedback = useCallback(() => {
    setMessage(null);
    if (state !== "pending") {
      setState(profile ? "success" : "idle");
    }
  }, [profile, state]);

  return {
    hasSigner,
    state,
    message,
    profile,
    signIn,
    resetFeedback,
    updateProfile,
  };
}
