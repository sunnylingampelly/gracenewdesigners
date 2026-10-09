import { ApiRequestError } from "@/lib/api-client";

/** Mirrors Laravel's Str::slug closely enough for previews and lowercase-hyphen codes. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "" -> null, otherwise trimmed text. */
export function textOrNull(value: string): string | null {
  const t = value.trim();
  return t ? t : null;
}

/** Sort order inputs: blank/invalid -> 0. */
export function toInt(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** ISO timestamp -> value for <input type="datetime-local"> in the viewer's timezone. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> ISO string (UTC) or null. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Best human message for a failed request (first validation message for 422s). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const first = Object.values(error.errors)[0]?.[0];
    return first ?? error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
