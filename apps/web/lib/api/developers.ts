import { buildApiUrl } from "./core";

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

export async function becomeDeveloper(
  payload: BecomeDeveloperRequest,
): Promise<DeveloperProfile> {
  const response = await fetch(buildApiUrl("/v1/devs"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((body) => (body?.detail as string | undefined) ?? "Unable to create developer profile.")
      .catch(() => "Unable to create developer profile.");
    throw new Error(message);
  }

  return (await response.json()) as DeveloperProfile;
}
