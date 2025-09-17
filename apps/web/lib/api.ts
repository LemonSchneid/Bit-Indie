const DEFAULT_API_BASE_URL = "http://localhost:8080";

const configuredBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  process.env.API_URL?.trim() ||
  DEFAULT_API_BASE_URL;

const apiBaseUrl = configuredBaseUrl.replace(/\/$/, "");

export interface HealthResponse {
  status: string;
}

function buildApiUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`API paths must start with a forward slash. Received: ${path}`);
  }

  return `${apiBaseUrl}${path}`;
}

export async function getApiHealth(): Promise<HealthResponse> {
  const response = await fetch(buildApiUrl("/health"), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as HealthResponse;

  return payload;
}
