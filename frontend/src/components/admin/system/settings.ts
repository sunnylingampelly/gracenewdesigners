"use client";

import { adminApi, useAdminMutation, useAdminQuery } from "@/lib/admin/hooks";

export type SettingsGroups = Record<string, Record<string, unknown>>;

export const SETTINGS_QUERY_KEY = ["admin", "/admin/settings"] as const;

export function useSettings() {
  return useAdminQuery<{ data: SettingsGroups }>("/admin/settings");
}

/** PATCH only the given keys (the API validates and saves partial updates per tab). */
export function useSaveSettings(success = "Settings saved") {
  return useAdminMutation((values: Record<string, unknown>) => adminApi.patch<{ data: SettingsGroups }>("/admin/settings", values), {
    success,
    invalidate: [[...SETTINGS_QUERY_KEY]],
  });
}

export const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
export const bool = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "true";
export const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
/** Empty strings become null so optional settings are cleared rather than stored as "". */
export const orNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());
