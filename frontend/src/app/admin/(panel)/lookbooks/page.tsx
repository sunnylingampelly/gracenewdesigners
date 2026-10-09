"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails come straight from backend renditions */
import { BookImage, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { Button, Card, DataTable, EmptyState, ErrorNotice, Field, Input, Modal, PageHeader, StatusBadge, type Column } from "@/components/admin/ui";
import { adminApi, useAdminMutation, useAdminQuery } from "@/lib/admin/hooks";
import { formatDate } from "@/lib/utils";

type LookbookRow = { id: number; title: string; slug: string; season: string | null; status: "draft" | "published"; sort_order: number; collection_id: number | null; items_count: number; cover_url: string | null; published_at: string | null };

export default function LookbooksPage() {
  return (
    <RequirePermission permission="content.manage">
      <LookbookList />
    </RequirePermission>
  );
}

function LookbookList() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: LookbookRow[] }>("/admin/lookbooks");

  const columns: Column<LookbookRow>[] = [
    {
      key: "title",
      header: "Lookbook",
      cell: (l) => (
        <div className="flex items-center gap-3">
          {l.cover_url ? <img src={l.cover_url} alt="" className="h-12 w-10 shrink-0 rounded object-cover" /> : <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400"><BookImage className="h-4 w-4" /></span>}
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{l.title}</p>
            <p className="text-xs text-slate-500">/lookbook/{l.slug}</p>
          </div>
        </div>
      ),
    },
    { key: "season", header: "Season", cell: (l) => l.season ?? <span className="text-slate-400">—</span> },
    { key: "items", header: "Images", cell: (l) => l.items_count, className: "tabular-nums" },
    { key: "status", header: "Status", cell: (l) => <StatusBadge status={l.status} /> },
    { key: "published", header: "Published", cell: (l) => (l.published_at ? formatDate(l.published_at) : "—"), hideOnMobile: true },
    { key: "sort", header: "Order", cell: (l) => l.sort_order, className: "tabular-nums", hideOnMobile: true },
  ];

  return (
    <>
      <PageHeader title="Lookbook" description="Editorial image stories linking to products and collections." actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New lookbook</Button>} />
      <Card padded={false}>
        {error ? (
          <div className="p-5"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data}
            rowKey={(l) => l.id}
            loading={isLoading}
            onRowClick={(l) => router.push(`/admin/lookbooks/${l.id}`)}
            empty={<EmptyState title="No lookbooks yet" description="Create a lookbook to tell a season’s story in images." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New lookbook</Button>} />}
          />
        )}
      </Card>
      <CreateLookbookDialog open={creating} onOpenChange={setCreating} onCreated={(id) => router.push(`/admin/lookbooks/${id}`)} />
    </>
  );
}

function CreateLookbookDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const [season, setSeason] = useState("");
  const titleId = useId();
  const seasonId = useId();
  const create = useAdminMutation(() => adminApi.post<{ data: { id: number } }>("/admin/lookbooks", { title, season: season || null, status: "draft" }), {
    success: "Lookbook created",
    invalidate: [["admin", "/admin/lookbooks"]],
    onSuccess: (r) => onCreated(r.data.id),
  });
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New lookbook"
      description="It starts as a draft — add images and publish when ready."
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
        <Field label="Season" htmlFor={seasonId} error={create.fieldError("season")} hint="e.g. Festive 2026">
          <Input id={seasonId} value={season} maxLength={80} onChange={(e) => setSeason(e.target.value)} />
        </Field>
        <button type="submit" className="sr-only" tabIndex={-1}>Create</button>
      </form>
    </Modal>
  );
}
