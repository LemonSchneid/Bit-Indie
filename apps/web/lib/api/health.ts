import { requestJson } from "./core";

export interface HealthResponse {
  status: string;
}

export async function getApiHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/health", {
    cache: "no-store",
  });
}
