"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { MediaField } from "@/components/admin/media-picker";
import { Badge, Button, Card, type Column, DataTable, EmptyState, ErrorNotice, Field, Modal, PageHeader, Switch } from "@/components/admin/ui";
import { slugify, textOrNull, toInt } from "@/components/admin/catalog/form-utils";
import { SeoFields, TextAreaField, TextField, Thumb, useDeleteConfirm } from "@/components/admin/catalog/shared";
import type { Occasion } from "@/components/admin/catalog/types";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation, useAdminQuery } from "@/lib/admin/hooks";

const OCCASIONS_KEY = ["admin", "/admin/occasions"];

export default function OccasionsPage() {
  return (
    <RequirePermission permission={["taxonomy.manage", "products.view"]}>
      <OccasionsBody />
    </RequirePermission>
  );
}

function OccasionsBody() {
  const { can } = useAuth();
  const canManage = can("taxonomy.manage");
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: Occasion[] }>("/admin/occasions");
  const [editing, setEditing] = useState<{ item: Occasion | null } | null>(null);
  const { confirmDelete, dialog } = useDeleteConfirm();

  const columns: Column<Occasion>[] = [
    {
      key: "name",
      header: "Occasion",
      cell: (o) => (
        <div className="flex items-center gap-3">
          <Thumb url={o.image_url} className="h-12 w-12" />
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{o.name}</p>
            {o.description && <p className="line-clamp-1 max-w-md text-xs text-slate-500">{o.description}</p>}
            <p className="font-mono text-xs text-slate-400">/occasions/{o.slug}</p>
          </div>
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (o) => (o.is_published ? <Badge tone="green">Published</Badge> : <Badge>Hidden</Badge>) },
    { key: "products", header: "Products", cell: (o) => <span className="tabular-nums">{o.products_count}</span> },
    { key: "sort", header: "Order", cell: (o) => <span className="tabular-nums text-slate-500">{o.sort_order}</span>, hideOnMobile: true },
    ...(canManage
      ? [{
          key: "actions",
          header: <span className="sr-only">Actions</span>,
          className: "text-right",
          cell: (o: Occasion) => (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing({ item: o })} aria-label={`Edit ${o.name}`}><Pencil className="h-4 w-4" /></Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${o.name}`}
                onClick={() => confirmDelete({
                  title: `Delete “${o.name}”?`,
                  description: `The ${o.products_count} products tagged with this occasion are not deleted — they are only unlinked from it.`,
                  path: `/admin/occasions/${o.id}`,
                  invalidate: [OCCASIONS_KEY],
                  success: "Occasion deleted",
                })}
              >
                <Trash2 className="h-4 w-4 text-red-700" />
              </Button>
            </div>
          ),
        } satisfies Column<Occasion>]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Occasions"
        description="Shop-by-occasion landing pages such as Wedding, Sangeet or Reception. Products are assigned to occasions from the product editor."
        actions={canManage ? <Button onClick={() => setEditing({ item: null })}><Plus className="h-4 w-4" /> New occasion</Button> : undefined}
      />
      <Card padded={false}>
        {error ? (
          <div className="p-5"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data}
            rowKey={(o) => o.id}
            loading={isLoading}
            empty={<EmptyState title="No occasions yet" description="Create occasions so shoppers can browse by event." />}
          />
        )}
      </Card>
      {editing && <OccasionModal key={editing.item?.id ?? "new"} occasion={editing.item} onClose={() => setEditing(null)} />}
      {dialog}
    </>
  );
}

function OccasionModal({ occasion, onClose }: { occasion: Occasion | null; onClose: () => void }) {
  const formId = useId();
  const [form, setForm] = useState({
    name: occasion?.name ?? "",
    slug: occasion?.slug ?? "",
    description: occasion?.description ?? "",
    image_media_id: occasion?.image_media_id ?? null,
    sort_order: String(occasion?.sort_order ?? 0),
    is_published: occasion?.is_published ?? true,
    seo_title: occasion?.seo_title ?? "",
    seo_description: occasion?.seo_description ?? "",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useAdminMutation(
    (body: Record<string, unknown>) => (occasion ? adminApi.patch(`/admin/occasions/${occasion.id}`, body) : adminApi.post("/admin/occasions", body)),
    { success: occasion ? "Occasion updated" : "Occasion created", invalidate: [OCCASIONS_KEY], onSuccess: onClose },
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      name: form.name.trim(),
      slug: textOrNull(form.slug),
      description: textOrNull(form.description),
      image_media_id: form.image_media_id,
      sort_order: toInt(form.sort_order),
      is_published: form.is_published,
      seo_title: textOrNull(form.seo_title),
      seo_description: textOrNull(form.seo_description),
    });
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={occasion ? `Edit ${occasion.name}` : "New occasion"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} loading={save.isPending}>{occasion ? "Save changes" : "Create occasion"}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" required value={form.name} onChange={(v) => set({ name: v })} error={save.fieldError("name")} maxLength={120} />
          <TextField label="Slug" value={form.slug} onChange={(v) => set({ slug: v.toLowerCase() })} error={save.fieldError("slug")} placeholder={slugify(form.name)} maxLength={120} hint={<>URL: <span className="font-mono">/occasions/{slugify(form.slug || form.name) || "…"}</span></>} />
        </div>
        <TextAreaField label="Description" value={form.description} onChange={(v) => set({ description: v })} error={save.fieldError("description")} maxLength={2000} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Image" error={save.fieldError("image_media_id")}>
            <MediaField value={form.image_media_id} preview={occasion?.image_url} onChange={(id) => set({ image_media_id: id })} />
          </Field>
          <TextField label="Sort order" type="number" value={form.sort_order} onChange={(v) => set({ sort_order: v })} error={save.fieldError("sort_order")} hint="Lower numbers appear first." />
        </div>
        <Switch label="Published" description="Show this occasion page and list it in shop-by-occasion." checked={form.is_published} onCheckedChange={(v) => set({ is_published: v })} />
        <SeoFields value={form} onChange={(v) => set(v)} fieldError={save.fieldError} />
      </form>
    </Modal>
  );
}
