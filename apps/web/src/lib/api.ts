const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function onAuthExpired(cb: () => void) {
  onUnauthorized = cb;
}

class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

// The refresh-token cookie makes /api/auth/refresh and /logout CSRF targets,
// so those two calls carry a double-submit token from /api/auth/csrf-token.
let csrfToken: string | null = null;
const CSRF_PROTECTED_PATHS = new Set(["/api/auth/refresh", "/api/auth/logout"]);

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const res = await fetch(`${API_URL}/api/auth/csrf-token`, { credentials: "include" });
  const body = await res.json();
  csrfToken = body.csrfToken;
  return csrfToken;
}

async function rawRequest(path: string, init: RequestInit) {
  const csrf = CSRF_PROTECTED_PATHS.has(path) ? await getCsrfToken() : null;
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {}),
      ...init.headers,
    },
  });
}

async function tryRefresh(): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/auth/refresh`, { method: "POST", credentials: "include" });
  if (!res.ok) return false;
  const body = await res.json();
  accessToken = body.accessToken;
  return true;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await rawRequest(path, init);

  if (res.status === 401 && path !== "/api/auth/login") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawRequest(path, init);
    } else {
      onUnauthorized?.();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiClient = {
  get: <T>(path: string) => api<T>(path),
  post: <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => api<T>(path, { method: "DELETE" }),
};
