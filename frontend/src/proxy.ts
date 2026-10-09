import { NextResponse, type NextRequest } from "next/server";

/**
 * SEO-safe URL handling for catalogue paths:
 *  - 301 for renamed products, categories and pages (admin-managed redirects table)
 *  - 410 Gone for archived or deleted products (rendered by /gone)
 * Results are cached briefly in memory to keep the per-request cost negligible.
 */
const API = `${(process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8010").replace(/\/$/, "")}/api/v1`;
const TTL_MS = 60_000;
type Status = { status: "live" | "missing" | "unknown" | "gone" } | { status: "redirect"; to: string; code: number };
const cache = new Map<string, { value: Status; expires: number }>();

async function pathStatus(path: string): Promise<Status> {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.value;
  try {
    const res = await fetch(`${API}/path-status?path=${encodeURIComponent(path)}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(1500) });
    const value: Status = res.ok ? (await res.json()).data : { status: "unknown" };
    if (cache.size > 2000) cache.clear();
    cache.set(path, { value, expires: Date.now() + TTL_MS });
    return value;
  } catch {
    return { status: "unknown" }; // never block the storefront on this check
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const status = await pathStatus(pathname.replace(/\/$/, "") || "/");

  if (status.status === "redirect") {
    const target = new URL(status.to, request.url);
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target, status.code === 302 ? 302 : 301);
  }
  if (status.status === "gone") {
    return NextResponse.rewrite(new URL("/gone", request.url), { status: 410 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/products/:slug", "/shop/:path*", "/pages/:slug", "/collections/:slug", "/lookbook/:slug"],
};
