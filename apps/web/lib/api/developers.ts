import { requestJson } from "./core";
import { resolveSessionToken } from "./session";

export interface DeveloperProfile {
  id: string;
  user_id: string;
  verified_dev: boolean;
  profile_url: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface BecomeDeveloperRequest {
  user_id: string;
  profile_url?: string | null;
  contact_email?: string | null;
}

export interface UpdateDeveloperProfilePayload {
  profile_url?: string | null;
  contact_email?: string | null;
}

export async function getDeveloperProfile(userId: string): Promise<DeveloperProfile> {
  const token = resolveSessionToken(
    null,
    "Sign in before managing your developer profile.",
  );
  return requestJson<DeveloperProfile>(`/v1/devs/${encodeURIComponent(userId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    errorMessage: "Unable to load developer profile.",
    notFoundMessage: "Developer profile not found.",
  });
}

export async function updateDeveloperProfile(
  userId: string,
  payload: UpdateDeveloperProfilePayload,
): Promise<DeveloperProfile> {
  const token = resolveSessionToken(
    null,
    "Sign in before managing your developer profile.",
  );
  return requestJson<DeveloperProfile>("/v1/devs", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      ...payload,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
    errorMessage: "Unable to update developer profile.",
  });
}

export async function becomeDeveloper(payload: BecomeDeveloperRequest): Promise<DeveloperProfile> {
  return updateDeveloperProfile(payload.user_id, {
    profile_url: payload.profile_url,
    contact_email: payload.contact_email,
  });
}
