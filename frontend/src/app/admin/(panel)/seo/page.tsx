"use client";

import { ArrowRight, Info, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { orNull, str, useSaveSettings, useSettings } from "@/components/admin/system/settings";
import { Badge, Button, Card, DataTable, EmptyState, ErrorNotice, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, Textarea, useConfirm, type Column } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation, useAdminQuery, useUnsavedChangesWarning, useUrlState } from "@/lib/admin/hooks";
import { formatDate } from "@/lib/utils";


type Redirect = { id: number; from_path: string; to_path: string | null; status_code: 301 | 302 | 410; hits: number; created_at: string | null; updated_at: string | null };

const REDIRECTS_KEY = ["admin", "/admin/redirects"];

export default function SeoPage() {
  return (
    <RequirePermission permission="seo.manage">
      <PageHeader title="SEO & marketing" description="Redirects for moved or retired URLs, search-engine defaults and privacy-respecting analytics." />
      <Suspense fallback={<Spinner />}>
        <SeoTabs />
      </Suspense>
    </RequirePermission>
  );
}

function SeoTabs() {
  const [state, setState] = useUrlState({ tab: "redirects" });
  return (
    <div className="space-y-6">
      <Tabs tabs={[{ value: "redirects", label: "Redirects" }, { value: "search", label: "Search & analytics" }]} active={state.tab} onChange={(tab) => setState({ tab })} />
      {state.tab === "search" ? <SearchSettings /> : <Redirects />}
    </div>
  );
}

// ---- Redirects -------------------------------------------------------------------------------------

function Redirects() {
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: Redirect[] }>("/admin/redirects");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Redirect | "new" | null>(null);
  const { confirm, dialog } = useConfirm();
  const remove = useAdminMutation((id: number) => adminApi.delete(`/admin/redirects/${id}`), { success: "Redirect deleted", invalidate: [REDIRECTS_KEY] });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.data ?? []).filter((r) => !q || r.from_path.toLowerCase().includes(q) || (r.to_path ?? "").toLowerCase().includes(q));
  }, [data, query]);

  const columns: Column<Redirect>[] = [
    { key: "from", header: "From", cell: (r) => <code className="text-xs break-all text-slate-800">{r.from_path}</code> },
    {
      key: "to",
      header: "To",
      cell: (r) => (r.status_code === 410 ? <span className="text-xs text-slate-500">Gone (no target)</span> : <code className="text-xs break-all text-slate-800">{r.to_path}</code>),
    },
    { key: "status", header: "Type", cell: (r) => <Badge tone={r.status_code === 301 ? "green" : r.status_code === 302 ? "blue" : "amber"}>{r.status_code === 301 ? "301 Permanent" : r.status_code === 302 ? "302 Temporary" : "410 Gone"}</Badge> },
    { key: "hits", header: "Hits", className: "text-right tabular-nums", cell: (r) => r.hits.toLocaleString("en-IN") },
    { key: "updated", header: "Updated", hideOnMobile: true, cell: (r) => <span className="text-xs text-slate-500">{formatDate(r.updated_at ?? r.created_at)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(r)} aria-label={`Edit redirect from ${r.from_path}`}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete redirect from ${r.from_path}`}
            onClick={() => confirm({ title: "Delete this redirect?", description: `Visitors to ${r.from_path} will see a “not found” page instead.`, confirmLabel: "Delete", destructive: true, action: () => remove.mutateAsync(r.id) })}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-700" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card
      padded={false}
      title="Redirects"
      description="Product and page slug changes create 301 redirects automatically. Add manual ones for old campaign links or retired pages."
      actions={<Button size="sm" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" aria-hidden /> Add redirect</Button>}
    >
      <div className="border-b border-slate-100 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by path" className="pl-9" aria-label="Filter redirects by path" />
        </div>
      </div>
      {error ? (
        <div className="p-4"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
      ) : (
        <DataTable
          columns={columns}
          rows={data ? rows : undefined}
          loading={isLoading}
          rowKey={(r) => r.id}
          empty={<EmptyState title={query ? "No matching redirects" : "No redirects yet"} description={query ? undefined : "Redirects you add, and those created automatically when slugs change, appear here."} />}
        />
      )}
      {data && data.data.length >= 500 && <p className="px-4 py-3 text-xs text-slate-500">Showing the 500 most recent redirects.</p>}
      {editing && <RedirectModal redirect={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {dialog}
    </Card>
  );
}

function RedirectModal({ redirect, onClose }: { redirect: Redirect | null; onClose: () => void }) {
  const [form, setForm] = useState({ from_path: redirect?.from_path ?? "/", to_path: redirect?.to_path ?? "", status_code: String(redirect?.status_code ?? 301) });
  const [clientError, setClientError] = useState<Record<string, string>>({});
  const gone = form.status_code === "410";
  const save = useAdminMutation(
    (body: Record<string, unknown>) => (redirect ? adminApi.patch(`/admin/redirects/${redirect.id}`, body) : adminApi.post("/admin/redirects", body)),
    { success: redirect ? "Redirect updated" : "Redirect created", invalidate: [REDIRECTS_KEY], onSuccess: onClose },
  );

  const submit = () => {
    const errors: Record<string, string> = {};
    const from = form.from_path.trim();
    const to = form.to_path.trim();
    if (!from.startsWith("/")) errors.from_path = "The old path must start with “/”, e.g. /old-collection.";
    if (!gone && !to) errors.to_path = "Enter where visitors should go.";
    else if (!gone && !/^(\/|https:\/\/)/.test(to)) errors.to_path = "Use a path starting with “/” or a full https:// URL.";
    else if (!gone && to === from) errors.to_path = "The target must differ from the old path.";
    setClientError(errors);
    if (Object.keys(errors).length) return;
    save.mutate({ from_path: from, to_path: gone ? null : to, status_code: Number(form.status_code) });
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={redirect ? "Edit redirect" : "Add redirect"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={submit}>{redirect ? "Save" : "Create redirect"}</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Old path" htmlFor="r-from" required error={clientError.from_path ?? save.fieldError("from_path")} hint="Path on this site only, without the domain — e.g. /collections/summer-2025.">
          <Input id="r-from" value={form.from_path} onChange={(e) => setForm({ ...form, from_path: e.target.value })} invalid={!!(clientError.from_path ?? save.fieldError("from_path"))} autoFocus />
        </Field>
        <Field label="Type" htmlFor="r-status" required error={save.fieldError("status_code")}>
          <Select id="r-status" value={form.status_code} onChange={(e) => setForm({ ...form, status_code: e.target.value })}>
            <option value="301">301 — Permanent (moved for good; passes search ranking)</option>
            <option value="302">302 — Temporary (e.g. seasonal campaign)</option>
            <option value="410">410 — Gone (retired permanently, no replacement)</option>
          </Select>
        </Field>
        {gone ? (
          <p className="flex items-start gap-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> A 410 tells search engines the page was removed on purpose, so it drops out of results faster. No target is needed.</p>
        ) : (
          <Field label="New destination" htmlFor="r-to" required error={clientError.to_path ?? save.fieldError("to_path")} hint="A path on this site (/new-page) or a full https:// URL.">
            <Input id="r-to" value={form.to_path} onChange={(e) => setForm({ ...form, to_path: e.target.value })} invalid={!!(clientError.to_path ?? save.fieldError("to_path"))} />
          </Field>
        )}
        {!gone && form.from_path && form.to_path && (
          <p className="flex items-center gap-2 text-xs text-slate-500"><code>{form.from_path}</code><ArrowRight className="h-3 w-3" aria-hidden /><code className="break-all">{form.to_path}</code></p>
        )}
        <button type="submit" className="sr-only">Save</button>
      </form>
    </Modal>
  );
}

// ---- Search & analytics ---------------------------------------------------------------------------

const SEO_KEYS = ["seo_title_suffix", "seo_default_description", "google_site_verification", "ga4_measurement_id"] as const;
type SeoForm = Record<(typeof SEO_KEYS)[number], string>;

function SearchSettings() {
  const { data, isLoading, error, refetch } = useSettings();
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNotice error={error} onRetry={() => refetch()} />;
  const seo = data.data.seo ?? {};
  const initial = Object.fromEntries(SEO_KEYS.map((k) => [k, str(seo[k])])) as SeoForm;
  return <SearchSettingsForm key={JSON.stringify(initial)} initial={initial} />;
}

function SearchSettingsForm({ initial }: { initial: SeoForm }) {
  const { can } = useAuth();
  const canSave = can("settings.manage");
  const [form, setForm] = useState<SeoForm>(initial);
  const [gaError, setGaError] = useState<string | null>(null);
  const save = useSaveSettings("Search & analytics settings saved");
  const dirty = SEO_KEYS.some((k) => form[k] !== initial[k]);
  useUnsavedChangesWarning(dirty);

  const submit = () => {
    const ga = form.ga4_measurement_id.trim().toUpperCase();
    if (ga && !/^G-[A-Z0-9]{4,20}$/.test(ga)) {
      setGaError("GA4 measurement IDs look like G-XXXXXXXXXX.");
      return;
    }
    setGaError(null);
    save.mutate({
      seo_title_suffix: orNull(form.seo_title_suffix),
      seo_default_description: orNull(form.seo_default_description),
      google_site_verification: orNull(form.google_site_verification),
      ga4_measurement_id: orNull(ga),
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card title="Search engines & analytics">
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field label="Title suffix" htmlFor="seo-suffix" error={save.fieldError("seo_title_suffix")} hint="Appended to page titles, e.g. “Bridal Lehengas | Grace New Designers”.">
            <Input id="seo-suffix" value={form.seo_title_suffix} maxLength={80} onChange={(e) => setForm({ ...form, seo_title_suffix: e.target.value })} disabled={!canSave} />
          </Field>
          <Field label="Default meta description" htmlFor="seo-desc" error={save.fieldError("seo_default_description")} hint={`Used when a page has no description of its own. ${form.seo_default_description.length}/300 — aim for 120–160 characters.`}>
            <Textarea id="seo-desc" rows={3} value={form.seo_default_description} maxLength={300} onChange={(e) => setForm({ ...form, seo_default_description: e.target.value })} disabled={!canSave} />
          </Field>
          <Field label="Google Search Console verification" htmlFor="seo-gsv" error={save.fieldError("google_site_verification")} hint="Only the content value of the google-site-verification meta tag, not the whole tag.">
            <Input id="seo-gsv" value={form.google_site_verification} maxLength={120} onChange={(e) => setForm({ ...form, google_site_verification: e.target.value })} disabled={!canSave} />
          </Field>
          <Field label="GA4 measurement ID" htmlFor="seo-ga" error={gaError ?? save.fieldError("ga4_measurement_id")} hint="Format G-XXXXXXXXXX. Leave empty to disable Google Analytics.">
            <Input id="seo-ga" value={form.ga4_measurement_id} placeholder="G-" onChange={(e) => setForm({ ...form, ga4_measurement_id: e.target.value.toUpperCase() })} invalid={!!(gaError ?? save.fieldError("ga4_measurement_id"))} disabled={!canSave} />
          </Field>
          {canSave ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={!dirty} onClick={() => setForm(initial)}>Discard</Button>
              <Button type="submit" loading={save.isPending} disabled={!dirty}>Save changes</Button>
            </div>
          ) : (
            <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">Saving these settings requires the “Manage brand and site settings” permission. Ask an owner or administrator to change them.</p>
          )}
        </form>
      </Card>
      <Card title="How analytics works here">
        <ul className="list-disc space-y-3 pl-4 text-sm text-slate-600">
          <li>Google Analytics 4 only loads <strong className="text-slate-800">after a visitor accepts analytics cookies</strong> in the consent banner. Visitors who decline are never tracked by GA4.</li>
          <li>WhatsApp clicks are recorded as <strong className="text-slate-800">enquiry intents</strong>, never as purchases. A tap on “Enquire on WhatsApp” does not mean a sale happened.</li>
          <li>Purchases and revenue are only counted from orders your team records and confirms in the admin, so reports never inflate sales.</li>
        </ul>
      </Card>
    </div>
  );
}
