"use client";

/**
 * Consent-aware analytics. Nothing is sent before the visitor accepts measurement cookies.
 * Events go to the first-party endpoint and, when configured, to GA4 via gtag.
 * Purchase events are never emitted from the storefront: a WhatsApp click is not a sale.
 * Personal data (names, phone numbers, emails, measurements) must never be passed here.
 */

export type AnalyticsEvent =
  | "page_view"
  | "view_item_list"
  | "select_item"
  | "view_item"
  | "search"
  | "select_size"
  | "select_color"
  | "add_to_wishlist"
  | "add_to_bag"
  | "whatsapp_enquiry_initiated";

type Params = Record<string, string | number | boolean | null | undefined>;

const CONSENT_KEY = "gnd-consent";
const SESSION_KEY = "gnd-session";
export type Consent = "granted" | "denied";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function getConsent(): Consent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(value: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* storage unavailable */
  }
  window.gtag?.("consent", "update", { analytics_storage: value });
  window.dispatchEvent(new CustomEvent("gnd:consent", { detail: value }));
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

const queue: { name: AnalyticsEvent; product_id?: number; path: string; params: Params }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  timer = null;
  if (!queue.length) return;
  const events = queue.splice(0, 20);
  const body = JSON.stringify({ events, session_id: sessionId() });
  const sent = navigator.sendBeacon?.("/backend/api/v1/analytics/events", new Blob([body], { type: "application/json" }));
  if (!sent) {
    fetch("/backend/api/v1/analytics/events", { method: "POST", body, headers: { "Content-Type": "application/json", Accept: "application/json" }, keepalive: true }).catch(() => undefined);
  }
}

/** Server-recorded events (e.g. enquiry intents) pass serverRecorded to avoid double counting. */
export function track(name: AnalyticsEvent, params: Params & { product_id?: number } = {}, options: { serverRecorded?: boolean } = {}): void {
  if (typeof window === "undefined" || getConsent() !== "granted") return;
  const { product_id, ...rest } = params;

  window.gtag?.("event", name, rest);

  if (!options.serverRecorded) {
    queue.push({ name, product_id, path: window.location.pathname, params: rest });
    if (!timer) timer = setTimeout(flush, 1500);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
}

/** UTM parameters captured on landing; only sent with an enquiry when the visitor consented. */
export function captureAttribution(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ["source", "medium", "campaign", "content", "term"]) {
      const value = params.get(`utm_${key}`);
      if (value) utm[key] = value.slice(0, 150);
    }
    if (Object.keys(utm).length) sessionStorage.setItem("gnd-utm", JSON.stringify(utm));
    if (document.referrer && !sessionStorage.getItem("gnd-referrer")) {
      const ref = new URL(document.referrer);
      if (ref.host !== window.location.host) sessionStorage.setItem("gnd-referrer", ref.origin);
    }
  } catch {
    /* ignore */
  }
}

export function attributionPayload(): { attribution_consent: boolean; utm?: Record<string, string>; referrer?: string } {
  if (getConsent() !== "granted") return { attribution_consent: false };
  try {
    return {
      attribution_consent: true,
      utm: JSON.parse(sessionStorage.getItem("gnd-utm") ?? "{}"),
      referrer: sessionStorage.getItem("gnd-referrer") ?? undefined,
    };
  } catch {
    return { attribution_consent: true };
  }
}
