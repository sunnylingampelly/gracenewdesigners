"use client";

/* eslint-disable @next/next/no-img-element -- QR code is a locally generated data URL */
import { Copy, Download, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, Field, Input, KeyValue, PageHeader } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation } from "@/lib/admin/hooks";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

export default function AccountPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Account & security" description="Your sign-in details, password and two-factor authentication." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title="Your account">
            <KeyValue
              items={[
                ["Name", user.name],
                ["Email", user.email],
                ["Roles", <span key="r" className="flex flex-wrap gap-1">{user.roles.map((r) => <Badge key={r.slug}>{r.name}</Badge>)}</span>],
                ["Last sign-in", formatDateTime(user.last_login_at)],
              ]}
            />
            <p className="mt-4 text-xs text-slate-500">To change your name or email, ask an owner to update your team profile.</p>
          </Card>
          <PasswordCard />
        </div>
        <TwoFactorCard />
      </div>
    </>
  );
}

function PasswordCard() {
  const { refresh } = useAuth();
  const empty = { current_password: "", password: "", password_confirmation: "" };
  const [form, setForm] = useState(empty);
  const [mismatch, setMismatch] = useState(false);
  const save = useAdminMutation((body: typeof form) => adminApi.put("/admin/auth/password", body), {
    success: "Password updated",
    onSuccess: () => {
      setForm(empty);
      refresh();
    },
  });

  return (
    <Card title="Change password" description="At least 12 characters, with upper- and lower-case letters, a number and a symbol.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const bad = form.password !== form.password_confirmation;
          setMismatch(bad);
          if (!bad) save.mutate(form);
        }}
      >
        <Field label="Current password" htmlFor="pw-current" required error={save.fieldError("current_password")}>
          <Input id="pw-current" type="password" autoComplete="current-password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} required invalid={!!save.fieldError("current_password")} />
        </Field>
        <Field label="New password" htmlFor="pw-new" required error={save.fieldError("password")}>
          <Input id="pw-new" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required invalid={!!save.fieldError("password")} />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm" required error={mismatch ? "The passwords don’t match." : undefined}>
          <Input id="pw-confirm" type="password" autoComplete="new-password" value={form.password_confirmation} onChange={(e) => { setForm({ ...form, password_confirmation: e.target.value }); setMismatch(false); }} required invalid={mismatch} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending} disabled={!form.current_password || !form.password || !form.password_confirmation}><KeyRound className="h-4 w-4" aria-hidden /> Update password</Button>
        </div>
      </form>
    </Card>
  );
}

type Enrollment = { secret: string; otpauth_url: string };

function TwoFactorCard() {
  const { user, refresh } = useAuth();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const begin = useAdminMutation(() => adminApi.post<{ data: Enrollment }>("/admin/auth/two-factor"), { onSuccess: (r) => setEnrollment(r.data) });

  return (
    <Card
      title="Two-factor authentication"
      description="Protects your account with a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) in addition to your password."
      actions={user.two_factor_enabled ? <Badge tone="green">On</Badge> : <Badge tone={user.two_factor_required ? "amber" : "slate"}>Off</Badge>}
    >
      {codes ? (
        <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />
      ) : user.two_factor_enabled ? (
        <DisableTwoFactor />
      ) : enrollment ? (
        <EnrollTwoFactor enrollment={enrollment} onCancel={() => setEnrollment(null)} onConfirmed={(c) => { setEnrollment(null); setCodes(c); refresh(); }} />
      ) : (
        <div className="space-y-4">
          {user.two_factor_required && (
            <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Your role requires two-factor authentication. Set it up to continue using the admin.</p>
          )}
          <p className="text-sm text-slate-600">You’ll scan a QR code with your authenticator app, then enter a code to confirm. You’ll also get one-time recovery codes in case you lose your phone.</p>
          <Button loading={begin.isPending} onClick={() => begin.mutate(undefined)}><ShieldCheck className="h-4 w-4" aria-hidden /> Set up two-factor authentication</Button>
        </div>
      )}
    </Card>
  );
}

function EnrollTwoFactor({ enrollment, onCancel, onConfirmed }: { enrollment: Enrollment; onCancel: () => void; onConfirmed: (codes: string[]) => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [code, setCode] = useState("");
  const confirm = useAdminMutation((c: string) => adminApi.post<{ data: { recovery_codes: string[] } }>("/admin/auth/two-factor/confirm", { code: c }), {
    success: "Two-factor authentication is on",
    onSuccess: (r) => onConfirmed(r.data.recovery_codes),
  });

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(enrollment.otpauth_url, { width: 208, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQrFailed(true));
    return () => {
      cancelled = true;
    };
  }, [enrollment.otpauth_url]);

  const grouped = enrollment.secret.replace(/(.{4})/g, "$1 ").trim();

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Open your authenticator app and add a new account.</li>
        <li>Scan the QR code, or type the setup key manually.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex h-52 w-52 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white">
          {qr ? <img src={qr} alt="QR code for your authenticator app" width={208} height={208} /> : qrFailed ? <span className="p-4 text-center text-xs text-slate-500">QR code unavailable — use the setup key.</span> : <span className="text-xs text-slate-400" role="status">Generating…</span>}
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-slate-700">Setup key</p>
          <code className="block rounded-md bg-slate-100 px-3 py-2 font-mono text-sm break-all text-slate-900" data-testid="two-factor-secret">{grouped}</code>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigator.clipboard.writeText(enrollment.secret).then(() => toast.success("Setup key copied"), () => toast.error("Could not copy — select the key manually."))}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden /> Copy key
          </Button>
          <p className="text-xs text-slate-500">Time-based (TOTP), 6 digits, 30 seconds.</p>
        </div>
      </div>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{6}$/.test(code)) confirm.mutate(code);
        }}
      >
        <Field label="6-digit code" htmlFor="tf-code" error={confirm.fieldError("code")} className="sm:w-48">
          <Input id="tf-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="font-mono tracking-[0.3em]" invalid={!!confirm.fieldError("code")} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" loading={confirm.isPending} disabled={code.length !== 6}>Confirm and turn on</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = codes.join("\n");
  const download = () => {
    const blob = new Blob([`Grace New Designers admin — recovery codes\nEach code can be used once.\n\n${text}\n`], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <div className="space-y-4">
      <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Save these recovery codes somewhere safe, like a password manager. Each code works once if you lose access to your authenticator app. <strong>They won’t be shown again.</strong>
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-4 font-mono text-sm text-slate-900" aria-label="Recovery codes">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Recovery codes copied"), () => toast.error("Could not copy — select the codes manually."))}><Copy className="h-3.5 w-3.5" aria-hidden /> Copy</Button>
        <Button variant="secondary" size="sm" onClick={download}><Download className="h-3.5 w-3.5" aria-hidden /> Download .txt</Button>
        <Button size="sm" onClick={onDone} className="ml-auto">I’ve saved them</Button>
      </div>
    </div>
  );
}

function DisableTwoFactor() {
  const { user, refresh } = useAuth();
  const [password, setPassword] = useState("");
  const disable = useAdminMutation((current_password: string) => apiFetch("/admin/auth/two-factor", { method: "DELETE", body: { current_password } }), {
    success: "Two-factor authentication turned off",
    onSuccess: () => {
      setPassword("");
      refresh();
    },
  });

  if (user.two_factor_required) {
    return (
      <p className="flex items-start gap-2 text-sm text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden /> Two-factor authentication is on. Your role requires it, so it can’t be turned off.</p>
    );
  }
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden /> Two-factor authentication is on. You’ll be asked for a code from your authenticator app each time you sign in.</p>
      <form
        className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (password) disable.mutate(password);
        }}
      >
        <Field label="Current password" htmlFor="tf-disable-pw" error={disable.fieldError("current_password")} hint="Required to turn off two-factor authentication." className="flex-1">
          <Input id="tf-disable-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!disable.fieldError("current_password")} />
        </Field>
        <Button type="submit" variant="danger" loading={disable.isPending} disabled={!password}>Turn off</Button>
      </form>
    </div>
  );
}
