"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/admin/auth-card";
import { Button, Field, Input } from "@/components/admin/ui";
import { apiFetch, ApiRequestError } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/admin/auth/forgot-password", { method: "POST", body: { email } });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiRequestError ? (e.field("email") ?? e.message) : "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Reset your password">
      {sent ? (
        <p className="text-sm text-slate-600" role="status">If an account exists for <strong>{email}</strong>, a reset link is on its way. The link expires in 60 minutes.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" htmlFor="email" error={error ?? undefined}>
            <Input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" loading={loading} className="w-full">Send reset link</Button>
        </form>
      )}
      <Link href="/admin/login" className="mt-6 block text-center text-sm text-royal hover:underline">Back to sign in</Link>
    </AuthCard>
  );
}
