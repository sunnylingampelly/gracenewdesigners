"use client";

import { Check, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useId, useState } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { PAGE_TEMPLATES } from "@/components/admin/content/shared";
import { TestimonialsPanel } from "@/components/admin/content/testimonials";
import { Button, Card, DataTable, EmptyState, ErrorNotice, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Tabs, type Column } from "@/components/admin/ui";
import { adminApi, useAdminMutation, useAdminQuery } from "@/lib/admin/hooks";
import { relativeTime } from "@/lib/utils";

type PageRow = { id: number; title: string; slug: string; template: string; excerpt: string | null; status: "draft" | "published"; show_in_footer: boolean; is_indexable: boolean; published_at: string | null; updated_at: string | null };


export default function PagesAndTestimonialsPage() {
  return (
    <RequirePermission permission="content.manage">
      <Suspense fallback={<Spinner />}>
        <PagesScreen />
      </Suspense>
    </RequirePermission>
  );
}

function PagesScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "testimonials" ? "testimonials" : "pages";
  return (
    <>
      <PageHeader title="Pages & Testimonials" description="Static pages such as policies and the house story, plus client testimonials." />
      <div className="mb-5">
        <Tabs tabs={[{ value: "pages", label: "Pages" }, { value: "testimonials", label: "Testimonials" }]} active={tab} onChange={(v) => router.replace(v === "pages" ? "/admin/pages" : "/admin/pages?tab=testimonials", { scroll: false })} />
      </div>
      {tab === "pages" ? <PagesList /> : <TestimonialsPanel />}
    </>
  );
}

function PagesList() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: PageRow[] }>("/admin/pages");
  const yes = (v: boolean) => (v ? <Check className="h-4 w-4 text-emerald-600" aria-label="Yes" /> : <span className="text-slate-400" aria-label="No">—</span>);
  const columns: Column<PageRow>[] = [
    { key: "title", header: "Title", cell: (p) => <span className="font-medium text-slate-900">{p.title}</span> },
    { key: "slug", header: "URL", cell: (p) => <span className="text-xs text-slate-500">/pages/{p.slug}</span> },
    { key: "template", header: "Template", cell: (p) => PAGE_TEMPLATES.find((t) => t.value === p.template)?.label ?? p.template, hideOnMobile: true },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
    { key: "footer", header: "Footer", cell: (p) => yes(p.show_in_footer), hideOnMobile: true },
    { key: "index", header: "Indexable", cell: (p) => yes(p.is_indexable), hideOnMobile: true },
    { key: "updated", header: "Updated", cell: (p) => <span className="text-xs text-slate-500">{relativeTime(p.updated_at)}</span> },
  ];
  return (
    <>
      <Card padded={false} title="Pages" actions={<Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New page</Button>}>
        {error ? (
          <div className="p-5"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data}
            rowKey={(p) => p.id}
            loading={isLoading}
            onRowClick={(p) => router.push(`/admin/pages/${p.id}`)}
            empty={<EmptyState title="No pages yet" description="Create pages such as Shipping & Returns or Our Story." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New page</Button>} />}
          />
        )}
      </Card>
      <CreatePageDialog open={creating} onOpenChange={setCreating} onCreated={(id) => router.push(`/admin/pages/${id}`)} />
    </>
  );
}

function CreatePageDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("default");
  const titleId = useId();
  const templateId = useId();
  const create = useAdminMutation(() => adminApi.post<{ data: { id: number } }>("/admin/pages", { title, template, status: "draft" }), {
    success: "Page created as draft",
    invalidate: [["admin", "/admin/pages"]],
    onSuccess: (r) => onCreated(r.data.id),
  });
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New page"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={create.isPending} disabled={!title.trim()} onClick={() => create.mutate(undefined)}>Create</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate(undefined); }}>
        <Field label="Title" htmlFor={titleId} required error={create.fieldError("title") ?? create.fieldError("slug")}>
          <Input id={titleId} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Template" htmlFor={templateId} error={create.fieldError("template")}>
          <Select id={templateId} value={template} onChange={(e) => setTemplate(e.target.value)}>
            {PAGE_TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        <button type="submit" className="sr-only" tabIndex={-1}>Create</button>
      </form>
    </Modal>
  );
}
