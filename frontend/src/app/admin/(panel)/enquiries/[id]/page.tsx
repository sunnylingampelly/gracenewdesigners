"use client";

import { Ban, Check, Copy, ExternalLink, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/admin/guard";
import { ENQUIRY_TYPES, HandoffBadge, isoToIstInput, istInputToIso, labelFor, Timeline, timelineMeta, useAssignees, useStatusLookups, whatsappDigits, type EnquiryDetail } from "@/components/admin/sales/shared";
import { Badge, Button, ButtonLink, buttonStyles, Card, ErrorNotice, Field, Input, KeyValue, PageHeader, Select, Spinner, StatusBadge, Textarea, useConfirm } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation, useAdminQuery, useUnsavedChangesWarning } from "@/lib/admin/hooks";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function EnquiryDetailPage() {
  return (
    <RequirePermission permission="enquiries.view">
      <EnquiryDetailBody />
    </RequirePermission>
  );
}

function EnquiryDetailBody() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const path = `/admin/enquiries/${id}`;
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: EnquiryDetail }>(path);
  const { lookups } = useStatusLookups();
  const { confirm, dialog } = useConfirm();
  const invalidate = [["admin", "/admin/enquiries"], ["admin", path]];

  const quick = useAdminMutation((status: string) => adminApi.patch(path, { status }), {
    success: "Status updated",
    invalidate,
  });
  const remove = useAdminMutation(() => adminApi.delete(path), {
    success: "Enquiry deleted",
    invalidate: [["admin", "/admin/enquiries"]],
    onSuccess: () => router.push("/admin/enquiries"),
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNotice error={error} onRetry={() => refetch()} />;
  const e = data.data;
  const manage = can("enquiries.manage");
  const typeLabel = labelFor(ENQUIRY_TYPES, e.type);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Enquiries", href: "/admin/enquiries" }, { label: e.reference }]}
        title={<span className="flex flex-wrap items-center gap-3">{e.reference} <StatusBadge status={e.status} label={e.status_label} /></span>}
        description={<span className="flex flex-wrap items-center gap-2">{typeLabel} enquiry · {formatDateTime(e.created_at)} IST <HandoffBadge at={e.redirect_initiated_at} /></span>}
        actions={
          <>
            {can("orders.manage") && (e.order ? (
              <span className="flex items-center gap-2 text-sm text-slate-600">
                <Button disabled title="This enquiry already has an order">Create order</Button>
                <Link href={`/admin/orders/${e.order.id}`} className="text-royal hover:underline">View {e.order.reference}</Link>
              </span>
            ) : (
              <ButtonLink href={`/admin/orders/new?enquiry=${e.id}`}>Create order</ButtonLink>
            ))}
            {manage && e.status !== "lost" && (
              <Button variant="secondary" onClick={() => confirm({ title: "Mark this enquiry as lost?", description: "Use this when the customer decided not to go ahead. You can reopen it later by changing the status.", confirmLabel: "Mark as lost", action: () => quick.mutateAsync("lost") })}>
                <Ban className="h-4 w-4" aria-hidden /> Mark as lost
              </Button>
            )}
            {manage && e.status !== "spam" && (
              <Button variant="secondary" onClick={() => confirm({ title: "Mark this enquiry as spam?", description: "It will move to the Spam tab and leave the open pipeline.", confirmLabel: "Mark as spam", destructive: true, action: () => quick.mutateAsync("spam") })}>
                <ShieldAlert className="h-4 w-4" aria-hidden /> Mark as spam
              </Button>
            )}
            {manage && (
              <Button variant="ghost" aria-label="Delete enquiry" onClick={() => confirm({ title: `Delete ${e.reference}?`, description: "The enquiry is removed from the inbox (soft delete). Linked orders are kept.", confirmLabel: "Delete enquiry", destructive: true, action: () => remove.mutateAsync(undefined) })}>
                <Trash2 className="h-4 w-4" aria-hidden /> Delete
              </Button>
            )}
          </>
        }
      />

      {e.order && (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Order <Link href={`/admin/orders/${e.order.id}`} className="font-medium underline">{e.order.reference}</Link> was recorded from this enquiry ({labelFor(lookups?.order, e.order.status)}).
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ItemsPanel e={e} />
          <div className="grid gap-6 md:grid-cols-2">
            <CustomerPanel e={e} />
            <DetailsPanel e={e} />
          </div>
          {e.customer_message && (
            <Card title="Customer message">
              <p className="text-sm whitespace-pre-wrap text-slate-800">{e.customer_message}</p>
            </Card>
          )}
          <WhatsAppPanel e={e} />
          <Card title="Status history">
            <Timeline
              entries={e.history.map((h, i) => ({
                key: i,
                title: h.from ? <>{labelFor(lookups?.enquiry, h.from)} → <strong className="font-medium">{labelFor(lookups?.enquiry, h.to)}</strong></> : <>Created as <strong className="font-medium">{labelFor(lookups?.enquiry, h.to)}</strong></>,
                body: h.note,
                meta: timelineMeta(h.user, h.created_at),
              }))}
              empty="No status changes yet."
            />
          </Card>
        </div>

        <div className="space-y-6">
          {manage ? (
            <LeadForm key={`${e.status}|${e.assigned_to?.id ?? ""}|${e.follow_up_at ?? ""}|${e.notes.length}`} e={e} path={path} />
          ) : (
            <Card title="Lead management">
              <KeyValue items={[["Status", e.status_label], ["Assigned to", e.assigned_to?.name ?? "Unassigned"], ["Follow-up", e.follow_up_at ? formatDateTime(e.follow_up_at) : null]]} />
            </Card>
          )}
          <Card title="Internal notes">
            <Timeline
              entries={[...e.notes].reverse().map((n) => ({ key: n.id, title: <span className="whitespace-pre-wrap">{n.body}</span>, meta: timelineMeta(n.user, n.created_at) }))}
              empty="No notes yet."
            />
          </Card>
        </div>
      </div>
      {dialog}
    </>
  );
}

function ItemsPanel({ e }: { e: EnquiryDetail }) {
  return (
    <Card title={`Items (${e.items.length})`} description="Snapshots taken when the enquiry was saved. Prices are what the site displayed, not an agreed price." padded={false}>
      {e.items.length ? (
        <ul className="divide-y divide-slate-100">
          {e.items.map((i) => (
            <li key={i.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium text-slate-900">
                  {i.product_id && i.product_exists ? <Link href={`/admin/products/${i.product_id}`} className="hover:underline">{i.product_name}</Link> : i.product_name}
                  {!i.product_exists && i.product_id && <Badge tone="amber" className="ml-2">Product removed</Badge>}
                </p>
                <p className="text-xs text-slate-500">SKU {i.variant_sku ?? i.product_sku ?? "—"}</p>
                <p className="flex flex-wrap gap-2 text-xs text-slate-600">
                  {i.is_custom_size ? <Badge tone="violet">Custom size</Badge> : i.size_label && <span>Size: {i.size_label}</span>}
                  {i.color_label && <span>Colour: {i.color_label}</span>}
                </p>
              </div>
              <div className="shrink-0 text-sm sm:text-right">
                <p className="tabular-nums">Qty {i.quantity}</p>
                <p className="text-slate-600">{i.price_label ?? "No price shown"}</p>
                <p className="text-xs text-slate-400">Displayed price</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-slate-500">No products — this is a {labelFor(ENQUIRY_TYPES, e.type).toLowerCase()} enquiry.</p>
      )}
      {e.display_total && <p className="border-t border-slate-100 px-5 py-3 text-right text-sm text-slate-600">Displayed total: <span className="font-medium text-slate-900">{e.display_total}</span></p>}
    </Card>
  );
}

function CustomerPanel({ e }: { e: EnquiryDetail }) {
  const c = e.customer;
  const hasAny = c && (c.name || c.phone || c.email || c.city || c.country);
  return (
    <Card title="Customer details" actions={c ? <Link href={`/admin/customers/${c.id}`} className="text-xs text-royal hover:underline">Customer record</Link> : undefined}>
      {hasAny ? (
        <KeyValue
          items={[
            ...(c.name ? [["Name", c.name] as [string, string]] : []),
            ...(c.phone ? [["Phone", c.phone] as [string, string]] : []),
            ...(c.email ? [["Email", <a key="e" href={`mailto:${c.email}`} className="text-royal hover:underline">{c.email}</a>] as [string, React.ReactNode]] : []),
            ...(c.city || c.country ? [["Location", [c.city, c.country].filter(Boolean).join(", ")] as [string, string]] : []),
            ["Marketing consent", c.marketing_consent ? "Yes" : "No"],
          ]}
        />
      ) : (
        <p className="text-sm text-slate-500">The visitor did not supply contact details on the site. Their details will be in the WhatsApp chat if they sent the message.</p>
      )}
    </Card>
  );
}

function DetailsPanel({ e }: { e: EnquiryDetail }) {
  const measurements = e.measurements && (Array.isArray(e.measurements) ? e.measurements.length > 0 : Object.keys(e.measurements).length > 0) ? e.measurements : null;
  const attribution = e.attribution && !Array.isArray(e.attribution) && Object.keys(e.attribution).length ? e.attribution : null;
  return (
    <Card title="Fitting & attribution">
      <div className="space-y-4 text-sm">
        <KeyValue items={[
          ["Fitting consultation", e.fitting_consultation_requested ? <Badge key="f" tone="violet">Requested</Badge> : "Not requested"],
          ...(e.preferred_date ? [["Preferred date", formatDate(e.preferred_date)] as [string, string]] : []),
          ["Source page", e.source_path ?? null],
        ]} />
        {measurements && (
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Measurements</h3>
            <KeyValue items={(Array.isArray(measurements) ? measurements.map((v, i) => [`#${i + 1}`, v] as [string, unknown]) : Object.entries(measurements)).map(([k, v]) => [k.replace(/_/g, " "), typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "—")])} />
          </div>
        )}
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Attribution</h3>
          {attribution ? (
            <KeyValue items={Object.entries(attribution).map(([k, v]) => [k.replace(/_/g, " "), v])} />
          ) : (
            <p className="text-slate-500">Not available — the visitor did not consent to attribution tracking, or arrived directly.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function WhatsAppPanel({ e }: { e: EnquiryDetail }) {
  const [copied, setCopied] = useState(false);
  const digits = whatsappDigits(e.customer?.phone);
  const copy = async () => {
    if (!e.whatsapp_message) return;
    try {
      await navigator.clipboard.writeText(e.whatsapp_message);
      setCopied(true);
      toast.success("Message copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — select the text and copy it manually.");
    }
  };
  return (
    <Card
      title="WhatsApp message"
      description={e.redirect_initiated_at ? `The visitor was handed off to WhatsApp at ${formatDateTime(e.redirect_initiated_at)} with this prefilled text. Whether they sent it is not known.` : "This prefilled text was prepared, but the WhatsApp handoff was not confirmed."}
      actions={
        <div className="flex gap-2">
          {e.whatsapp_message && <Button size="sm" variant="secondary" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />} Copy</Button>}
          {digits && <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className={buttonStyles("secondary", "sm")}><ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open chat</a>}
        </div>
      }
    >
      {e.whatsapp_message ? <pre className="max-h-80 overflow-auto rounded-md bg-slate-50 p-3 font-sans text-sm whitespace-pre-wrap text-slate-800">{e.whatsapp_message}</pre> : <p className="text-sm text-slate-500">No message text was stored.</p>}
    </Card>
  );
}

function LeadForm({ e, path }: { e: EnquiryDetail; path: string }) {
  const { lookups } = useStatusLookups();
  const { assignees } = useAssignees();
  const initial = { status: e.status, assigned_to: e.assigned_to ? String(e.assigned_to.id) : "", follow_up_at: isoToIstInput(e.follow_up_at) };
  const [form, setForm] = useState({ ...initial, status_note: "", note: "" });
  const dirty = form.status !== initial.status || form.assigned_to !== initial.assigned_to || form.follow_up_at !== initial.follow_up_at || !!form.status_note.trim() || !!form.note.trim();
  useUnsavedChangesWarning(dirty);

  const save = useAdminMutation((body: Record<string, unknown>) => adminApi.patch<{ data: EnquiryDetail }>(path, body), {
    success: "Enquiry updated",
    invalidate: [["admin", "/admin/enquiries"], ["admin", path]],
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const body: Record<string, unknown> = {};
    if (form.status !== initial.status) {
      body.status = form.status;
      if (form.status_note.trim()) body.status_note = form.status_note.trim();
    }
    if (form.assigned_to !== initial.assigned_to) body.assigned_to = form.assigned_to ? Number(form.assigned_to) : null;
    if (form.follow_up_at !== initial.follow_up_at) body.follow_up_at = istInputToIso(form.follow_up_at);
    if (form.note.trim()) body.note = form.note.trim();
    if (!Object.keys(body).length) return;
    save.mutate(body);
  };

  return (
    <Card title="Lead management">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Status" htmlFor="lead-status" error={save.fieldError("status")}>
          <Select id="lead-status" value={form.status} onChange={(ev) => setForm({ ...form, status: ev.target.value })}>
            {(lookups?.enquiry ?? [{ value: e.status, label: e.status_label }]).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        {form.status !== initial.status && (
          <Field label="Status note" htmlFor="lead-status-note" hint="Saved with the status change in the history." error={save.fieldError("status_note")}>
            <Textarea id="lead-status-note" rows={2} value={form.status_note} onChange={(ev) => setForm({ ...form, status_note: ev.target.value })} maxLength={1000} />
          </Field>
        )}
        <Field label="Assigned to" htmlFor="lead-assignee" error={save.fieldError("assigned_to")}>
          <Select id="lead-assignee" value={form.assigned_to} onChange={(ev) => setForm({ ...form, assigned_to: ev.target.value })}>
            <option value="">Unassigned</option>
            {assignees.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
            {e.assigned_to && !assignees.some((a) => a.id === e.assigned_to!.id) && <option value={String(e.assigned_to.id)}>{e.assigned_to.name} (inactive)</option>}
          </Select>
        </Field>
        <Field label="Follow-up (IST)" htmlFor="lead-follow" error={save.fieldError("follow_up_at")} hint={e.is_overdue ? <span className="text-red-700">Follow-up is overdue.</span> : undefined}>
          <div className="flex gap-2">
            <Input id="lead-follow" type="datetime-local" value={form.follow_up_at} onChange={(ev) => setForm({ ...form, follow_up_at: ev.target.value })} />
            {form.follow_up_at && <Button variant="ghost" size="sm" className="h-10" onClick={() => setForm({ ...form, follow_up_at: "" })} aria-label="Clear follow-up">Clear</Button>}
          </div>
        </Field>
        <Field label="Add internal note" htmlFor="lead-note" hint="Visible to staff only." error={save.fieldError("note")}>
          <Textarea id="lead-note" rows={3} value={form.note} onChange={(ev) => setForm({ ...form, note: ev.target.value })} maxLength={5000} />
        </Field>
        <div className="flex justify-end gap-2">
          {dirty && <Button variant="ghost" onClick={() => setForm({ ...initial, status_note: "", note: "" })}>Reset</Button>}
          <Button type="submit" loading={save.isPending} disabled={!dirty}>Save changes</Button>
        </div>
      </form>
    </Card>
  );
}
