"use client";

import { useMemo } from "react";

import { buildAccountDisplayName } from "../../lib/account-display";
import { useStoredUserProfile } from "../../lib/hooks/use-stored-user-profile";

export function HeaderAccountStatus(): JSX.Element {
  const profile = useStoredUserProfile();
  const displayName = useMemo(() => buildAccountDisplayName(profile), [profile]);

  if (!profile) {
    return <span className="text-xs uppercase tracking-[0.35em] text-[#d6ffe8]">Guest</span>;
  }

  const identity = displayName || "Account";

  return <span className="text-xs uppercase tracking-[0.35em] text-[#d6ffe8]">{identity}</span>;
}
