/**
 * Browser API client. Requests go through the same-origin /backend rewrite so Laravel Sanctum's
 * cookie session and CSRF protection work for the admin. Errors are normalized to ApiRequestError.
 */
"use client";

export const API_BASE = "/backend/api/v1";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string[]> = {},
    public code?: string,
  ) {
    super(message);
  }

  /** First message for a field (supports nested keys like "variants.0.sku"). */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

let csrfReady: Promise<void> | null = null;

/** Sanctum sets the XSRF-TOKEN cookie; it must exist before any state-changing request. */
export function ensureCsrf(force = false): Promise<void> {
  if (force || !csrfReady || !readCookie("XSRF-TOKEN")) {
    csrfReady = fetch("/sanctum/csrf-cookie", { credentials: "include" }).then(() => undefined);
  }
  return csrfReady;
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; query?: Record<string, unknown> };

export async function apiFetch<T>(path: string, { body, query, headers, method = "GET", ...init }: Options = {}): Promise<T> {
  const upper = method.toUpperCase();
  if (upper !== "GET" && upper !== "HEAD") await ensureCsrf();

  const url = new URL(API_BASE + path, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const send = () =>
    fetch(url, {
      method: upper,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(isForm || body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(readCookie("XSRF-TOKEN") ? { "X-XSRF-TOKEN": readCookie("XSRF-TOKEN")! } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      ...init,
    });

  let res = await send();
  // Expired CSRF token: refresh once and retry.
  if (res.status === 419) {
    await ensureCsrf(true);
    res = await send();
  }

  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      payload.message ?? (res.status === 429 ? "Too many requests. Please wait a moment and try again." : "Something went wrong. Please try again."),
      payload.errors ?? {},
      payload.code,
    );
  }
  return payload as T;
}

/** Upload with progress (fetch has no upload progress events). */
export function uploadWithProgress<T>(path: string, form: FormData, onProgress: (percent: number) => void): Promise<T> {
  return ensureCsrf().then(
    () =>
      new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", API_BASE + path);
        xhr.withCredentials = true;
        xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        const token = readCookie("XSRF-TOKEN");
        if (token) xhr.setRequestHeader("X-XSRF-TOKEN", token);
        xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
        xhr.onload = () => {
          const payload = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) resolve(payload as T);
          else reject(new ApiRequestError(xhr.status, payload.message ?? "Upload failed.", payload.errors ?? {}));
        };
        xhr.onerror = () => reject(new ApiRequestError(0, "Network error during upload."));
        xhr.send(form);
      }),
  );
}

/** Download a file (CSV exports) using the authenticated session. */
export async function downloadFile(path: string, query: Record<string, unknown> = {}): Promise<void> {
  const url = new URL(API_BASE + path, window.location.origin);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, { credentials: "include", headers: { Accept: "text/csv" } });
  if (!res.ok) throw new ApiRequestError(res.status, "The export could not be generated.");
  const blob = await res.blob();
  const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? "export.csv";
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
