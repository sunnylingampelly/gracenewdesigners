"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";

export type PageMeta = { current_page: number; last_page: number; per_page: number; total: number };
export type ListResponse<T, M = object> = { data: T[]; meta: PageMeta & M };

/** GET helper with stable keys: ["admin", path, query]. */
export function useAdminQuery<T>(
  path: string | null,
  query: Record<string, unknown> = {},
  options: { keepPrevious?: boolean; refetchInterval?: number | false | ((data: T | undefined) => number | false) } = {},
) {
  const { refetchInterval } = options;
  return useQuery({
    queryKey: ["admin", path, query],
    queryFn: () => apiFetch<T>(path!, { query }),
    enabled: path !== null,
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
    refetchInterval: typeof refetchInterval === "function" ? (q) => refetchInterval(q.state.data as T | undefined) : refetchInterval,
  });
}

/**
 * Mutation helper: shows a success toast, invalidates related admin queries and surfaces
 * Laravel validation errors (422) to the caller via `fieldErrors`.
 */
export function useAdminMutation<TVars = unknown, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  { success, invalidate = [], onSuccess }: { success?: string | ((result: TResult) => string); invalidate?: QueryKey[]; onSuccess?: (result: TResult, vars: TVars) => void } = {},
) {
  const queryClient = useQueryClient();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const mutation = useMutation({
    mutationFn: fn,
    onMutate: () => setFieldErrors({}),
    onSuccess: async (result, vars) => {
      for (const key of invalidate) await queryClient.invalidateQueries({ queryKey: key });
      if (success) toast.success(typeof success === "function" ? success(result) : success);
      onSuccess?.(result, vars);
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        setFieldErrors(error.errors);
        toast.error(error.status === 422 ? (Object.values(error.errors)[0]?.[0] ?? error.message) : error.message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const fieldError = useCallback((name: string) => fieldErrors[name]?.[0], [fieldErrors]);
  return { ...mutation, fieldErrors, fieldError, setFieldErrors };
}

export const adminApi = {
  get: <T>(path: string, query?: Record<string, unknown>) => apiFetch<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Keep list filters in the URL so admin views are linkable and survive reloads. */
export function useUrlState<T extends Record<string, string>>(defaults: T): [T, (patch: Partial<T>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const state = { ...defaults } as T;
  for (const key of Object.keys(defaults)) {
    const v = params.get(key);
    if (v !== null) (state as Record<string, string>)[key] = v;
  }
  const update = (patch: Partial<T>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "" || v === defaults[k]) next.delete(k);
      else next.set(k, String(v));
    }
    if (!("page" in patch)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [state, update];
}

/** Warn before leaving a page with unsaved form changes. */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
