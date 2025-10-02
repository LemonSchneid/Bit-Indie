import { requestJson } from "./core";
import { resolveSessionToken } from "./session";

export interface UserProfile {
  id: string;
  account_identifier: string;
  email: string | null;
  display_name: string | null;
  lightning_address: string | null;
  reputation_score: number;
  is_admin: boolean;
  is_developer: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateLightningAddressRequest {
  lightning_address: string;
}

export async function updateUserLightningAddress(
  userId: string,
  lightningAddress: string,
): Promise<UserProfile> {
  const payload: UpdateLightningAddressRequest = { lightning_address: lightningAddress };
  const sessionToken = resolveSessionToken(
    null,
    "Sign in before updating your Lightning address.",
  );
  return requestJson<UserProfile>(`/v1/users/${encodeURIComponent(userId)}/lightning-address`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    errorMessage: "Unable to update your Lightning address.",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });
}

