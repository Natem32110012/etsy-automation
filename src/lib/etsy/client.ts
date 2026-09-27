import { ETSY_API_BASE, etsyApiKeyHeader } from "./config";
import { readTokens, writeTokens } from "./store";
import { refreshAccessToken } from "./auth";

const MIN_INTERVAL_MS = 120;
let lastCallAt = 0;
let chain: Promise<unknown> = Promise.resolve();

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

export class EtsyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
  }
}

async function authorizedHeaders(): Promise<HeadersInit> {
  let tokens = await readTokens();
  if (!tokens) throw new Error("Etsy shop is not connected. Open Shop → Connect Etsy first.");
  if (tokens.expires_at < Date.now() + 60_000) {
    tokens = await refreshAccessToken(tokens.refresh_token);
    await writeTokens(tokens);
  }

  return {
    "x-api-key": etsyApiKeyHeader(),
    Authorization: `Bearer ${tokens.access_token}`,
  };
}

async function parseError(response: Response) {
  const body = await response.text();
  let message = `Etsy API ${response.status}`;
  try {
    const json = JSON.parse(body) as { error?: string; error_description?: string };
    message = json.error_description || json.error || message;
  } catch {
    if (body) message = body.slice(0, 400);
  }
  throw new EtsyApiError(message, response.status, body);
}

async function send(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  return throttle(async () => {
    const response = await fetch(url, init);
    if (response.status === 429 && attempt < 5) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "2");
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000 * (attempt + 1)));
      return send(url, init, attempt + 1);
    }
    if (!response.ok) await parseError(response);
    return response;
  });
}

export async function etsyGet<T>(pathname: string, query?: Record<string, string | number | undefined>) {
  const headers = await authorizedHeaders();
  const url = new URL(`${ETSY_API_BASE}${pathname}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  const response = await send(url.toString(), { headers });
  return (await response.json()) as T;
}

export async function etsyForm<T>(
  pathname: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  fields: Record<string, string | number | boolean | undefined>,
) {
  const headers = await authorizedHeaders();
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    body.set(key, String(value));
  }
  const response = await send(`${ETSY_API_BASE}${pathname}`, {
    method,
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (response.status === 204) return null as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function etsyMultipart<T>(pathname: string, form: FormData) {
  const headers = await authorizedHeaders();
  const response = await send(`${ETSY_API_BASE}${pathname}`, {
    method: "POST",
    headers,
    body: form,
  });
  return (await response.json()) as T;
}
