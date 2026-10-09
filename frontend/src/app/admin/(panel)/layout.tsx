"use client";

import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/shell";
import { AdminAuthGate } from "@/lib/admin/auth";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGate
      fallback={
        <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-slate-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading admin…
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </AdminAuthGate>
  );
}
