import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Media } from "./types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const inrFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatMoney(amount: number | string | null | undefined, currency = "INR"): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (currency === "INR") return inrFormatter.format(value);
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(value);
}

const OPS_TZ = "Asia/Kolkata";

export function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: OPS_TZ, ...options }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDate(value, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return "just now";
}

/** Build a srcset from backend renditions (WebP), widest-appropriate source chosen by the browser. */
export function srcSet(media: Media | null | undefined): string | undefined {
  if (!media?.sources?.length) return undefined;
  return media.sources
    .filter((s) => s.format === "webp" && s.width)
    .map((s) => `${s.url} ${s.width}w`)
    .join(", ");
}

export function mediaUrl(media: Media | null | undefined, preferred: "thumb" | "sm" | "md" | "lg" | "xl" = "md"): string | undefined {
  if (!media) return undefined;
  return media.sources.find((s) => s.name === preferred)?.url ?? media.sources.at(-1)?.url ?? media.url;
}

export function splitParagraphs(text: string | null | undefined): string[] {
  return (text ?? "").split(/\n+/).map((p) => p.trim()).filter(Boolean);
}

export function absoluteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}
