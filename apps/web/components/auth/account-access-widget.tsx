"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { loginAccount, logoutAccount, signUpAccount } from "../../lib/api/auth";
import { useStoredUserProfile } from "../../lib/hooks/use-stored-user-profile";
import { useMutation, useQueryClient } from "../../lib/react-query";
import { clearUserSession, storeUserSession } from "../../lib/user-session";
import { loadStoredSessionToken } from "../../lib/user-storage";
import { buildAccountDisplayName } from "../../lib/account-display";
import { SIGN_IN_BENEFITS } from "./sign-in-benefits";
import { MicroLabel, NeonCard } from "./auth-ui";

type AuthMode = "login" | "signup";

export function AccountAccessWidget(): JSX.Element {
  const queryClient = useQueryClient();
  const profile = useStoredUserProfile();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loginMutation = useMutation({
    mutationFn: loginAccount,
    onSuccess: (session) => {
      storeUserSession(queryClient, session.user, session.session_token);
      setSuccessMessage("Signed in successfully.");
      setErrorMessage(null);
      setPassword("");
    },
    onError: (error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign you in.");
      setSuccessMessage(null);
    },
  });

  const signupMutation = useMutation({
    mutationFn: signUpAccount,
    onSuccess: (session) => {
      storeUserSession(queryClient, session.user, session.session_token);
      setSuccessMessage("Account created and signed in.");
      setErrorMessage(null);
      setPassword("");
      setDisplayName("");
      setMode("login");
    },
    onError: (error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create your account.");
      setSuccessMessage(null);
    },
  });

  const logoutMutation = useMutation<void, string | null>({
    mutationFn: (token) => logoutAccount(token),
    onSuccess: () => {
      setSuccessMessage("Signed out successfully.");
      setErrorMessage(null);
    },
    onError: (error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign you out.");
      setSuccessMessage(null);
    },
  });

  const isSubmitting = loginMutation.isPending || signupMutation.isPending;
  const hasAccount = profile !== null;
  const displayIdentity = useMemo(() => buildAccountDisplayName(profile), [profile]);
  const heading = mounted && hasAccount ? "You're signed in" : "Accounts are live";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorMessage("Email is required.");
      return;
    }
    if (password.trim().length < 8) {
      setErrorMessage("Use at least 8 characters for your password.");
      return;
    }

    if (mode === "login") {
      loginMutation.mutate({ email: normalizedEmail, password });
    } else {
      signupMutation.mutate({
        email: normalizedEmail,
        password,
        display_name: displayName.trim() || null,
      });
    }
  };

  const toggleMode = () => {
    setMode((current) => (current === "login" ? "signup" : "login"));
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleLogout = () => {
    const sessionToken = loadStoredSessionToken();
    clearUserSession(queryClient);
    setMode("login");
    setSuccessMessage("Signed out successfully.");
    setErrorMessage(null);
    logoutMutation.mutate(sessionToken);
  };

  const formHeading = mode === "login" ? "Sign in" : "Create an account";
  const submitLabel = mode === "login" ? "Sign in" : "Create account";
  const toggleLabel = mode === "login" ? "Need an account?" : "Already have an account?";
  const toggleCta = mode === "login" ? "Create one" : "Sign in";

  return (
    <NeonCard className="w-full max-w-sm p-6 lg:ml-10">
      <MicroLabel>Accounts & guest access</MicroLabel>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-white" suppressHydrationWarning>
        {heading}
      </h3>
      <p className="mt-2 text-sm text-[#7bffc8]/80">
        Use a Bit Indie account to sync purchases, reviews, and moderation roles across every device. You can still check out as
        a guest whenever you prefer.
      </p>
      <ul className="mt-5 space-y-4 text-sm text-[#cbd5f5]/80">
        {SIGN_IN_BENEFITS.map((benefit) => (
          <li key={benefit.title} className="flex gap-3">
            <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[#2dff85]/60 bg-[rgba(21,34,26,0.9)] text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-[#c6ffe9]">
              ✶
            </span>
            <div>
              <p className="font-semibold text-[#f5fff8]">{benefit.title}</p>
              <p className="text-xs leading-relaxed text-[#7a7a7a]">{benefit.description}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 space-y-4">
        {errorMessage ? (
          <p className="rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200">
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p className="rounded-md border border-[#2dff85]/50 bg-[#2dff85]/10 px-3 py-2 text-xs font-medium text-[#d6ffe8]">
            {successMessage}
          </p>
        ) : null}

        {mounted && hasAccount ? (
          <div className="space-y-3 rounded-xl border border-[#2dff85]/30 bg-[rgba(15,22,18,0.9)] p-4">
            <p className="text-sm text-[#d6ffe8]">
              Signed in as <span className="font-semibold text-white">{displayIdentity}</span>
            </p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="w-full rounded-full border border-[#ff7b7b]/60 bg-[rgba(32,16,16,0.9)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#ffd6d6] transition hover:border-[#ffb0b0] hover:text-white disabled:opacity-60"
            >
              {logoutMutation.isPending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#dcfff2]/80">{formHeading}</h4>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70" htmlFor="account-email">
                Email
              </label>
              <input
                id="account-email"
                type="email"
                required
                autoComplete={mode === "login" ? "email" : "new-email"}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-[#2dff85]/30 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#7bffc8] focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70" htmlFor="account-password">
                Password
              </label>
              <input
                id="account-password"
                type="password"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-[#2dff85]/30 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#7bffc8] focus:outline-none"
              />
            </div>
            {mode === "signup" ? (
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-[#7bffc8]/70" htmlFor="account-display-name">
                  Display name (optional)
                </label>
                <input
                  id="account-display-name"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded-md border border-[#2dff85]/30 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#7bffc8] focus:outline-none"
                />
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full border border-[#2dff85]/60 bg-[rgba(17,32,23,0.95)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#d6ffe8] transition hover:border-[#7affc8] hover:text-white disabled:opacity-60"
            >
              {isSubmitting ? "Submitting…" : submitLabel}
            </button>
            <button
              type="button"
              onClick={toggleMode}
              className="w-full text-center text-xs uppercase tracking-[0.3em] text-[#7bffc8]/70 transition hover:text-[#d6ffe8]"
            >
              {toggleLabel} {toggleCta}
            </button>
          </form>
        )}
      </div>
    </NeonCard>
  );
}
