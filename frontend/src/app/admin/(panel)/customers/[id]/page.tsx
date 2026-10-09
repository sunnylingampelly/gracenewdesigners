"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { customerLabel } from "@/components/admin/sales/customer-picker";
import { labelFor, useStatusLookups, whatsappDigits } from "@/components/admin/sales/shared";
import { Button, buttonStyles, Card, Checkbox, ErrorNotice, Field, Input, KeyValue, Modal, PageHeader, Spinner, StatusBadge, Textarea } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation, useAdminQuery, useUnsavedChangesWarning } from "@/lib/admin/hooks";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";

type CustomerDetail = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  created_at: string;
  enquiries: { id: number; reference: string; status: string; created_at: string }[];
  orders: { id: number; reference: string; status: string; total: string; created_at: string }[];
};

export default function CustomerDetailPage() {
  return (
    <RequirePermission permission="customers.view">
      <CustomerDetailBody />
    </RequirePermission>
  );
}

function CustomerDetailBody() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const path = `/admin/customers/${id}`;
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: CustomerDetail }>(path);
  const { lookups } = useStatusLookups();
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNotice error={error} onRetry={() => refetch()} />;
  const c = data.data;
  const manage = can("customers.manage");
  const wa = whatsappDigits(c.phone);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customers", href: "/admin/customers" }, { label: customerLabel(c) }]}
        title={customerLabel(c)}
        description={`Customer since ${formatDate(c.created_at)}`}
        actions={
          <>
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={buttonStyles("secondary")}>Open WhatsApp chat</a>}
            {manage && <Button variant="danger" onClick={() => setAnonymizeOpen(true)}><ShieldAlert className="h-4 w-4" aria-hidden /> Anonymize (privacy request)</Button>}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {manage ? (
            <CustomerForm key={`${c.name}|${c.phone}|${c.email}|${c.city}|${c.country}|${c.notes}|${c.marketing_consent}`} c={c} path={path} />
          ) : (
            <Card title="Details">
              <KeyValue items={[["Name", c.name], ["Phone", c.phone], ["Email", c.email], ["City", c.city], ["Country", c.country], ["Marketing consent", c.marketing_consent ? `Yes (${formatDateTime(c.marketing_consent_at)})` : "No"], ["Notes", c.notes ? <span key="n" className="whitespace-pre-wrap">{c.notes}</span> : null]]} />
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title={`Enquiries (${c.enquiries.length})`} padded={false}>
            {c.enquiries.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {c.enquiries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span>
                      {can("enquiries.view") ? <Link href={`/admin/enquiries/${e.id}`} className="font-medium text-royal hover:underline">{e.reference}</Link> : <span className="font-medium">{e.reference}</span>}
                      <span className="block text-xs text-slate-500">{formatDateTime(e.created_at)}</span>
                    </span>
                    <StatusBadge status={e.status} label={labelFor(lookups?.enquiry, e.status)} />
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-4 text-sm text-slate-500">No enquiries.</p>}
          </Card>
          <Card title={`Orders (${c.orders.length})`} padded={false}>
            {c.orders.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {c.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span>
                      {can("orders.view") ? <Link href={`/admin/orders/${o.id}`} className="font-medium text-royal hover:underline">{o.reference}</Link> : <span className="font-medium">{o.reference}</span>}
                      <span className="block text-xs text-slate-500">{formatDate(o.created_at)} · {formatMoney(o.total)}</span>
                    </span>
                    <StatusBadge status={o.status} label={labelFor(lookups?.order, o.status)} />
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-4 text-sm text-slate-500">No orders.</p>}
          </Card>
        </div>
      </div>
      {manage && <AnonymizeDialog open={anonymizeOpen} onOpenChange={setAnonymizeOpen} path={path} />}
    </>
  );
}

function CustomerForm({ c, path }: { c: CustomerDetail; path: string }) {
  const initial = { name: c.name ?? "", phone: c.phone ?? "", email: c.email ?? "", city: c.city ?? "", country: c.country ?? "", notes: c.notes ?? "", marketing_consent: c.marketing_consent };
  const [form, setForm] = useState(initial);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedChangesWarning(dirty);
  const save = useAdminMutation((body: Record<string, unknown>) => adminApi.patch(path, body), {
    success: "Customer saved",
    invalidate: [["admin", "/admin/customers"], ["admin", path]],
  });
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const trimmed = (v: string) => v.trim() || null;
    save.mutate({ name: trimmed(form.name), phone: trimmed(form.phone), email: trimmed(form.email), city: trimmed(form.city), country: trimmed(form.country), notes: trimmed(form.notes), marketing_consent: form.marketing_consent });
  };
  const text = (key: "name" | "phone" | "email" | "city" | "country", label: string, type = "text", max = 150) => (
    <Field label={label} htmlFor={`cust-${key}`} error={save.fieldError(key)}>
      <Input id={`cust-${key}`} type={type} value={form[key]} maxLength={max} onChange={(e) => setForm({ ...form, [key]: e.target.value })} invalid={!!save.fieldError(key)} />
    </Field>
  );
  return (
    <Card title="Details">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", "Name")}
          {text("phone", "Phone", "tel", 32)}
          {text("email", "Email", "email", 190)}
          {text("city", "City", "text", 120)}
          {text("country", "Country", "text", 80)}
        </div>
        <Checkbox
          label="Marketing consent"
          description={c.marketing_consent && c.marketing_consent_at ? `Recorded ${formatDateTime(c.marketing_consent_at)}. Only change this when the customer asks.` : "Only tick this if the customer explicitly agreed to marketing messages."}
          checked={form.marketing_consent}
          onChange={(e) => setForm({ ...form, marketing_consent: e.target.checked })}
        />
        <Field label="Internal notes" htmlFor="cust-notes" error={save.fieldError("notes")}>
          <Textarea id="cust-notes" rows={4} value={form.notes} maxLength={5000} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          {dirty && <Button variant="ghost" onClick={() => setForm(initial)}>Reset</Button>}
          <Button type="submit" loading={save.isPending} disabled={!dirty}>Save customer</Button>
        </div>
      </form>
    </Card>
  );
}

function AnonymizeDialog({ open, onOpenChange, path }: { open: boolean; onOpenChange: (o: boolean) => void; path: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const anonymize = useAdminMutation(() => adminApi.post(`${path}/anonymize`), {
    success: "Customer anonymized",
    invalidate: [["admin", "/admin/customers"], ["admin", "/admin/enquiries"], ["admin", "/admin/orders"]],
    onSuccess: () => { onOpenChange(false); router.push("/admin/customers"); },
  });
  const ok = typed.trim().toUpperCase() === "ANONYMIZE";
  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) setTyped(""); onOpenChange(o); }}
      title="Anonymize this customer?"
      description="Use this only for a verified privacy / data-erasure request."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="danger" disabled={!ok} loading={anonymize.isPending} onClick={() => anonymize.mutate(undefined)}>Anonymize permanently</Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        <p>Their name, phone, email, city and notes will be erased, along with enquiry messages, measurements and order shipping contact details. Their newsletter subscription is removed. Enquiries and orders are kept as anonymous records.</p>
        <p className="font-medium text-red-800">This cannot be undone.</p>
        <Field label={<>Type <span className="font-mono">ANONYMIZE</span> to confirm</>} htmlFor="anon-confirm">
          <Input id="anon-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
      </div>
    </Modal>
  );
}
