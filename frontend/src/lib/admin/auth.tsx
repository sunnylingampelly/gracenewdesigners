"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api-client";

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  roles: { slug: string; name: string }[];
  permissions: string[];
  two_factor_enabled: boolean;
  two_factor_required: boolean;
  last_login_at: string | null;
};

type AuthContextValue = {
  user: AdminUser;
  /** UI convenience only — the API enforces every permission server-side. */
  can: (permission: string | string[]) => boolean;
  logout: () => Promise<void>;
  refresh: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AdminAuthGate>");
  return value;
}

export function useCan(permission: string | string[]): boolean {
  return useAuth().can(permission);
}

export const ME_QUERY_KEY = ["admin", "me"] as const;

/** Loads the signed-in admin; redirects to the login page when the session is missing or expired. */
export function AdminAuthGate({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => apiFetch<{ data: AdminUser }>("/admin/auth/me").then((r) => r.data),
    retry: false,
    staleTime: 60_000,
  });

  const unauthenticated = error instanceof ApiRequestError && error.status === 401;
  useEffect(() => {
    if (unauthenticated) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [unauthenticated, router, pathname]);

  if (isLoading || unauthenticated || !data) {
    if (error && !unauthenticated) {
      return (
        <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-red-700" role="alert">
          The admin could not load ({(error as Error).message}). <button className="ml-2 underline" onClick={() => refetch()}>Retry</button>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  const can = (permission: string | string[]) => (Array.isArray(permission) ? permission : [permission]).some((p) => data.permissions.includes(p));
  const logout = async () => {
    await apiFetch("/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    queryClient.clear();
    router.replace("/admin/login");
  };

  return <AuthContext.Provider value={{ user: data, can, logout, refresh: () => refetch() }}>{children}</AuthContext.Provider>;
}
