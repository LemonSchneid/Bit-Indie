const DEFAULT_API_BASE_URL = "http://localhost:8080";

const configuredBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  process.env.API_URL?.trim() ||
  DEFAULT_API_BASE_URL;

export const apiBaseUrl = configuredBaseUrl.replace(/\/$/, "");

export function buildApiUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`API paths must start with a forward slash. Received: ${path}`);
  }

  return `${apiBaseUrl}${path}`;
}

export async function parseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (typeof item?.msg === "string") {
            return item.msg;
          }
          return null;
        })
        .filter((value): value is string => Boolean(value));
      if (messages.length > 0) {
        return messages.join(" ");
      }
    }
    return fallback;
  } catch (error) {
    return fallback;
  }
}

interface RequestJsonOptions extends RequestInit {
  errorMessage?: string;
  treat404AsNull?: boolean;
  notFoundMessage?: string;
  forbiddenMessage?: string;
}

export async function requestJson<T>(
  path: string,
  options: RequestJsonOptions & { treat404AsNull: true },
): Promise<T | null>;
export async function requestJson<T>(path: string, options?: RequestJsonOptions): Promise<T>;
export async function requestJson<T>(
  path: string,
  options: RequestJsonOptions = {},
): Promise<T | null> {
  const {
    errorMessage,
    treat404AsNull = false,
    notFoundMessage,
    forbiddenMessage,
    headers,
    ...init
  } = options;

  const url = path.startsWith("http://") || path.startsWith("https://") ? path : buildApiUrl(path);

  const finalHeaders = new Headers({ Accept: "application/json" });
  if (headers) {
    const provided = new Headers(headers);
    provided.forEach((value, key) => {
      finalHeaders.set(key, value);
    });
  }

  if (init.body !== undefined && typeof init.body === "string" && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers: finalHeaders,
  });

  if (response.status === 404) {
    if (treat404AsNull) {
      return null;
    }
    if (notFoundMessage) {
      throw new Error(notFoundMessage);
    }
  }

  if (response.status === 403 && forbiddenMessage) {
    throw new Error(forbiddenMessage);
  }

  if (!response.ok) {
    const fallback =
      errorMessage ?? `Request to ${url} failed with status ${response.status}.`;
    const message = await parseErrorMessage(response, fallback);
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new Error("Failed to parse JSON response.");
  }
}

