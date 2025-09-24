import { loadStoredSessionToken } from "../user-storage";
import { requestJson } from "./core";
import type { UserProfile } from "./auth";

export interface UpdateLightningAddressRequest {
  lightning_address: string;
}

export async function updateUserLightningAddress(
  userId: string,
  lightningAddress: string,
): Promise<UserProfile> {
  const sessionToken = loadStoredSessionToken();
  if (!sessionToken) {
    throw new Error("Sign in before updating your Lightning address.");
  }

  const payload: UpdateLightningAddressRequest = { lightning_address: lightningAddress };
  return requestJson<UserProfile>(`/v1/users/${encodeURIComponent(userId)}/lightning-address`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    errorMessage: "Unable to update your Lightning address.",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });
}

