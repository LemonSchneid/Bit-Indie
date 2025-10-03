import type { UserProfile } from "./api";

export function buildAccountDisplayName(profile: UserProfile | null): string {
  if (!profile) {
    return "";
  }

  if (profile.display_name) {
    return profile.display_name;
  }

  if (profile.email) {
    return profile.email;
  }

  return profile.account_identifier;
}

