import type { Metadata } from "next";
import { AdminProviders } from "@/components/admin/providers";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Grace New Designers" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50 font-sans text-slate-900">
      <AdminProviders>{children}</AdminProviders>
    </div>
  );
}
