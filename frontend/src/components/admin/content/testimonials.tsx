"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails come straight from backend renditions */
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Pencil, Plus, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorNotice, Field, Input, Modal, Spinner, Textarea, useConfirm } from "@/components/admin/ui";
import { adminApi, useAdminMutation, useAdminQuery } from "@/lib/admin/hooks";
import { ApiRequestError } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { MediaIdField } from "./shared";

export type Testimonial = {
  id: number; author_name: string; location: string | null; occasion: string | null; quote: string; media_asset_id: number | null;
  consent_confirmed: boolean; is_approved: boolean; sort_order: number | null; approved_by: string | null; approved_at: string | null; image_url: string | null;
};

const KEY = ["admin", "/admin/testimonials"];

export function TestimonialsPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: Testimonial[] }>("/admin/testimonials");
  const [editing, setEditing] = useState<Testimonial | "new" | null>(null);
  const [approvalError, setApprovalError] = useState<{ id: number; message: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const { confirm, dialog } = useConfirm();

  const setApproval = async (t: Testimonial, approved: boolean) => {
    setBusy(t.id);
    setApprovalError(null);
    try {
      await adminApi.post(`/admin/testimonials/${t.id}/approval`, { approved });
      toast.success(approved ? "Testimonial approved — it can now appear on the site" : "Testimonial unapproved — hidden from the site");
      await queryClient.invalidateQueries({ queryKey: KEY });
    } catch (e) {
      const message = e instanceof ApiRequestError || e instanceof Error ? e.message : "Could not update approval";
      setApprovalError({ id: t.id, message });
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const remove = (t: Testimonial) =>
    confirm({
      title: `Delete testimonial from ${t.author_name}?`,
      description: "It will be removed from the site immediately.",
      confirmLabel: "Delete",
      destructive: true,
      action: async () => {
        try {
          await adminApi.delete(`/admin/testimonials/${t.id}`);
          toast.success("Testimonial deleted");
          await queryClient.invalidateQueries({ queryKey: KEY });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not delete");
        }
      },
    });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900" role="note">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Only genuine, consented testimonials may be published.</p>
          <p className="mt-1 text-sky-800">Every testimonial must be the client’s real words, and you must have their permission to show it (with any name, location or photo). Never write, embellish or combine reviews. A testimonial can only be approved once consent is confirmed, and editing the quote or name sends it back for approval.</p>
        </div>
      </div>

      <Card title="Testimonials" description="Approved testimonials appear in the homepage testimonials section." actions={<Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add testimonial</Button>} padded={false}>
        {isLoading ? (
          <Spinner />
        ) : error || !data ? (
          <div className="p-5"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
        ) : data.data.length === 0 ? (
          <EmptyState title="No testimonials yet" description="Add a testimonial a client has given you permission to share." action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add testimonial</Button>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.data.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
                {t.image_url ? <img src={t.image_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-500">{t.author_name.slice(0, 1)}</span>}
                <div className="min-w-0 flex-1">
                  <blockquote className="text-sm text-slate-800">“{t.quote}”</blockquote>
                  <p className="mt-1 text-xs text-slate-500">— {t.author_name}{t.location && `, ${t.location}`}{t.occasion && ` · ${t.occasion}`}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.is_approved ? <Badge tone="green">Approved{t.approved_by ? ` by ${t.approved_by}` : ""}{t.approved_at ? ` · ${formatDate(t.approved_at)}` : ""}</Badge> : <Badge tone="amber">Awaiting approval</Badge>}
                    {t.consent_confirmed ? <Badge tone="blue">Consent confirmed</Badge> : <Badge tone="red">No consent recorded</Badge>}
                  </div>
                  {approvalError?.id === t.id && <p className="mt-2 text-xs text-red-700" role="alert">{approvalError.message}</p>}
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {t.is_approved ? (
                    <Button size="sm" variant="secondary" loading={busy === t.id} onClick={() => setApproval(t, false)}><XCircle className="h-3.5 w-3.5" /> Unapprove</Button>
                  ) : (
                    <Button size="sm" variant="secondary" loading={busy === t.id} onClick={() => setApproval(t, true)}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)} aria-label={`Edit testimonial from ${t.author_name}`}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(t)} aria-label={`Delete testimonial from ${t.author_name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing && <TestimonialDialog key={editing === "new" ? "new" : editing.id} testimonial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {dialog}
    </div>
  );
}

function TestimonialDialog({ testimonial, onClose }: { testimonial: Testimonial | null; onClose: () => void }) {
  const [form, setForm] = useState({
    author_name: testimonial?.author_name ?? "",
    location: testimonial?.location ?? "",
    occasion: testimonial?.occasion ?? "",
    quote: testimonial?.quote ?? "",
    media_asset_id: testimonial?.media_asset_id ?? null,
    consent_confirmed: testimonial?.consent_confirmed ?? false,
    sort_order: testimonial?.sort_order ?? 0,
  });
  const ids = { name: useId(), loc: useId(), occ: useId(), quote: useId(), sort: useId() };
  const save = useAdminMutation(
    () => {
      const body = { ...form, location: form.location || null, occasion: form.occasion || null, sort_order: Number(form.sort_order) || 0 };
      return testimonial ? adminApi.patch(`/admin/testimonials/${testimonial.id}`, body) : adminApi.post("/admin/testimonials", body);
    },
    { success: testimonial ? "Testimonial saved" : "Testimonial added — approve it to publish", invalidate: [KEY], onSuccess: onClose },
  );
  const fe = save.fieldError;
  const textChanged = testimonial?.is_approved && (form.quote !== testimonial.quote || form.author_name !== testimonial.author_name);

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={testimonial ? "Edit testimonial" : "Add testimonial"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} disabled={!form.author_name.trim() || !form.quote.trim()} onClick={() => save.mutate(undefined)}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Client name" htmlFor={ids.name} required error={fe("author_name")} hint="As the client agreed to be credited.">
            <Input id={ids.name} value={form.author_name} maxLength={120} onChange={(e) => setForm({ ...form, author_name: e.target.value })} invalid={!!fe("author_name")} />
          </Field>
          <Field label="Location" htmlFor={ids.loc} error={fe("location")}>
            <Input id={ids.loc} value={form.location} maxLength={120} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
          <Field label="Occasion" htmlFor={ids.occ} error={fe("occasion")}>
            <Input id={ids.occ} value={form.occasion} maxLength={120} onChange={(e) => setForm({ ...form, occasion: e.target.value })} placeholder="e.g. Wedding" />
          </Field>
        </div>
        <Field label="Quote" htmlFor={ids.quote} required error={fe("quote")} hint={`The client’s own words, unedited apart from spelling. ${form.quote.length}/1500`}>
          <Textarea id={ids.quote} rows={5} value={form.quote} maxLength={1500} onChange={(e) => setForm({ ...form, quote: e.target.value })} invalid={!!fe("quote")} />
        </Field>
        {textChanged && <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">Changing the quote or name will unpublish this testimonial until it is approved again.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Photo" error={fe("media_asset_id")} hint="Only with the client’s permission.">
            <MediaIdField value={form.media_asset_id} preview={testimonial && form.media_asset_id === testimonial.media_asset_id ? testimonial.image_url : null} onChange={(v) => setForm({ ...form, media_asset_id: v })} />
          </Field>
          <Field label="Sort order" htmlFor={ids.sort} error={fe("sort_order")} hint="Lower numbers appear first.">
            <Input id={ids.sort} type="number" min={0} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="max-w-32" />
          </Field>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <Checkbox
            checked={form.consent_confirmed}
            onChange={(e) => setForm({ ...form, consent_confirmed: e.target.checked })}
            label="The client has given consent to publish this testimonial"
            description="Tick only if you hold the client’s permission (e.g. in writing or a saved message) to publish these words, their name/location as shown and any photo. Without consent the testimonial cannot be approved."
          />
          {fe("consent_confirmed") && <p className="mt-2 text-xs text-red-700" role="alert">{fe("consent_confirmed")}</p>}
        </div>
      </div>
    </Modal>
  );
}
