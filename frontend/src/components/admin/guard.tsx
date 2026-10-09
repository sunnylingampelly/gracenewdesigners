"use client";

import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/admin/auth";
import { EmptyState } from "./ui";

/**
 * Hides admin screens the user has no access to. This is a UX affordance only —
 * every API endpoint enforces the same permissions server-side.
 */
export function RequirePermission({ permission, children }: { permission: string | string[]; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="You don’t have access to this area" description="Ask an owner or administrator if you need it." />;
  }
  return <>{children}</>;
}
