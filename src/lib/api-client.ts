export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = void>(url: string, init: { method?: string; json?: unknown; body?: BodyInit } = {}): Promise<T> {
  const hasJson = init.json !== undefined;
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: hasJson ? { "content-type": "application/json" } : undefined,
    body: hasJson ? JSON.stringify(init.json) : init.body,
  }).catch(() => {
    throw new ApiError(0, "Network error. Check your connection and try again.");
  });
  if (res.status === 401) window.location.assign("/login");
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Something went wrong");
  return body as T;
}
