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

