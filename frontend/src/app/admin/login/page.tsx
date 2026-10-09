"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard } from "@/components/admin/auth-card";
import { Button, Field, Input } from "@/components/admin/ui";
import { apiFetch, ApiRequestError, ensureCsrf } from "@/lib/api-client";
import { ME_QUERY_KEY } from "@/lib/admin/auth";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"credentials" | "two-factor">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = params.get("next");
  const destination = next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";

  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    router.replace(destination);
  };

  const submitCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await ensureCsrf(true);
      const result = await apiFetch<{ data: { two_factor_required?: boolean } }>("/admin/auth/login", { method: "POST", body: { email, password, remember } });
      if (result.data.two_factor_required) setStep("two-factor");
      else await finish();
    } catch (e) {
      setError(e instanceof ApiRequestError ? (e.status === 429 ? "Too many attempts. Please wait a minute and try again." : (e.field("email") ?? e.message)) : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/admin/auth/two-factor-challenge", { method: "POST", body: { code } });
      await finish();
    } catch (e) {
      setError(e instanceof ApiRequestError ? (e.field("code") ?? e.message) : "Unable to verify the code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title={step === "credentials" ? "Sign in to the studio admin" : "Two-factor verification"}>
      {step === "credentials" ? (
        <form onSubmit={submitCredentials} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!error} />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!error} />
          </Field>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-slate-900" /> Keep me signed in
            </label>
            <Link href="/admin/forgot-password" className="text-royal hover:underline">Forgot password?</Link>
          </div>
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Sign in</Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-4">
          <p className="text-sm text-slate-600">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
          <Field label="Verification code" htmlFor="code">
            <Input id="code" autoFocus autoComplete="one-time-code" inputMode="text" value={code} onChange={(e) => setCode(e.target.value.trim())} invalid={!!error} />
          </Field>
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Verify</Button>
          <button type="button" onClick={() => { setStep("credentials"); setCode(""); setError(null); }} className="w-full text-sm text-slate-500 hover:underline">Back</button>
        </form>
      )}
    </AuthCard>
  );
}
