import type { ApiError, ApiErrorBody } from "@/shared/api-types";

/**
 * The browser's only way to reach the server. It knows URLs and JSON, nothing about the rules:
 * whatever it sends, the server decides. Each call is also published to the on-page
 * "API activity" log so the client–server split is visible during the demo.
 */

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiError };

export interface ApiCallRecord {
  id: number;
  at: Date;
  method: string;
  path: string;
  status: number;
  message?: string;
}

type Listener = (call: ApiCallRecord) => void;
const listeners = new Set<Listener>();
let nextCallId = 1;

export function subscribeToApiCalls(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function send<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<ApiResult<T>> {
  let status = 0;
  let payload: unknown = null;
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? extraHeaders : { "Content-Type": "application/json", ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
    status = res.status;
    payload = status === 204 ? null : await res.json().catch(() => null);
  } catch {
    // Network failure: status stays 0.
  }

  const ok = status >= 200 && status < 300;
  const error: ApiError | undefined = ok
    ? undefined
    : ((payload as ApiErrorBody | null)?.error ?? {
        code: "network_error",
        message: status === 0 ? "Couldn't reach the server." : `Request failed (${status}).`,
      });

  const call: ApiCallRecord = { id: nextCallId++, at: new Date(), method, path, status, message: error?.message };
  listeners.forEach((listener) => listener(call));

  return error ? { ok: false, status, error } : { ok: true, status, data: payload as T };
}

export const api = {
  get: <T>(path: string) => send<T>("GET", path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => send<T>("POST", path, body, headers),
  patch: <T>(path: string, body: unknown, headers?: Record<string, string>) => send<T>("PATCH", path, body, headers),
  delete: <T>(path: string) => send<T>("DELETE", path),
};
