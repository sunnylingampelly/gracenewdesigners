"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard } from "@/components/admin/auth-card";
import { Button, Field, Input } from "@/components/admin/ui";
import { apiFetch, ApiRequestError } from "@/lib/api-client";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      await apiFetch("/admin/auth/reset-password", {
        method: "POST",
        body: { token: params.get("token"), email: params.get("email"), password, password_confirmation: confirmation },
      });
      setDone(true);
    } catch (e) {
      setErrors(e instanceof ApiRequestError ? { ...e.errors, form: [e.message] } : { form: ["Please try again."] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Choose a new password">
      {done ? (
        <div className="space-y-4 text-sm" role="status">
          <p>Your password has been updated.</p>
          <Link href="/admin/login" className="font-medium text-royal hover:underline">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" htmlFor="password" hint="At least 12 characters with upper and lower case letters, a number and a symbol." error={errors.password?.[0]}>
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <Input id="confirm" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </Field>
          {errors.email && <p className="text-sm text-red-700" role="alert">{errors.email[0]}</p>}
          <Button type="submit" loading={loading} className="w-full">Update password</Button>
        </form>
      )}
    </AuthCard>
  );
}
