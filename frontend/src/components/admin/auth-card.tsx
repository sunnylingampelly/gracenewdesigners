import type { ReactNode } from "react";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="display text-3xl tracking-[0.3em] text-midnight uppercase">Grace</p>
          <p className="text-[0.6rem] font-semibold tracking-[0.4em] text-slate-500 uppercase">New Designers · Admin</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-lg font-semibold text-slate-900">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
