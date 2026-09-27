/** API route'larının `{ error }` gövdesini Error mesajına çeviren tek giriş noktası. */
export async function api<T>(url: string, body?: unknown, method?: string): Promise<T> {
  const verb = method ?? (body === undefined ? "GET" : "POST");
  const response = await fetch(url, {
    method: verb,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `İstek başarısız (${response.status})`);
  }
  return data as T;
}
