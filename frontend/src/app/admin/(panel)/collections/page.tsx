"use client";

import { ListOrdered, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { Badge, Button, ButtonLink, Card, type Column, DataTable, EmptyState, ErrorNotice, Modal, PageHeader } from "@/components/admin/ui";
import { CollectionFields, collectionFormState, collectionPayload, seasonLabel } from "@/components/admin/catalog/collection-form";
import { Thumb, useDeleteConfirm } from "@/components/admin/catalog/shared";
import type { Collection } from "@/components/admin/catalog/types";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation, useAdminQuery, useDebounced } from "@/lib/admin/hooks";

const COLLECTIONS_KEY = ["admin", "/admin/collections"];

export default function CollectionsPage() {
  return (
    <RequirePermission permission={["taxonomy.manage", "products.view"]}>
      <CollectionsBody />
    </RequirePermission>
  );
}

function CollectionsBody() {
  const router = useRouter();
  const { can } = useAuth();
  const canManage = can("taxonomy.manage");
  const [q, setQ] = useState("");
  const debounced = useDebounced(q);
  const { data, isLoading, isFetching, error, refetch } = useAdminQuery<{ data: Collection[] }>("/admin/collections", { q: debounced || undefined }, { keepPrevious: true });
  const [editing, setEditing] = useState<{ item: Collection | null } | null>(null);
  const { confirmDelete, dialog } = useDeleteConfirm();

  const columns: Column<Collection>[] = [
    {
      key: "name",
      header: "Collection",
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Thumb url={c.cover_url} className="h-12 w-12" />
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{c.name}</p>
            {c.tagline && <p className="line-clamp-1 text-xs text-slate-500">{c.tagline}</p>}
            <p className="font-mono text-xs text-slate-400">/collections/{c.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.is_published ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}
          {c.is_featured && <Badge tone="violet">Featured</Badge>}
        </div>
      ),
    },
    { key: "products", header: "Products", cell: (c) => <span className="tabular-nums">{c.products_count}</span> },
    { key: "season", header: "Season", cell: (c) => <span className="text-xs text-slate-600">{seasonLabel(c)}</span> },
    { key: "sort", header: "Order", cell: (c) => <span className="tabular-nums text-slate-500">{c.sort_order}</span>, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      cell: (c) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <ButtonLink href={`/admin/collections/${c.id}`} size="sm" variant="secondary"><ListOrdered className="h-4 w-4" /> {canManage ? "Curate" : "View"}</ButtonLink>
          {canManage && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing({ item: c })} aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${c.name}`}
                onClick={() => confirmDelete({
                  title: `Delete “${c.name}”?`,
                  description: `The ${c.products_count} products in this collection are not deleted — they are only removed from it.`,
                  path: `/admin/collections/${c.id}`,
                  invalidate: [COLLECTIONS_KEY],
                  success: "Collection deleted",
                })}
              >
                <Trash2 className="h-4 w-4 text-red-700" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Collections"
        description="Curated, story-led edits of products. Open a collection to choose its products and their order."
        actions={canManage ? <Button onClick={() => setEditing({ item: null })}><Plus className="h-4 w-4" /> New collection</Button> : undefined}
      />
      <Card padded={false}>
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-sm">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search collections" aria-label="Search collections" className="h-10 w-full rounded-md border border-slate-300 pr-3 pl-9 text-sm shadow-sm focus:border-royal focus:ring-2 focus:ring-royal/20 focus:outline-none" />
          </div>
        </div>
        {error ? (
          <div className="p-5"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data}
            rowKey={(c) => c.id}
            loading={isLoading || isFetching}
            onRowClick={(c) => router.push(`/admin/collections/${c.id}`)}
            empty={<EmptyState title={debounced ? "No collections match your search" : "No collections yet"} description={debounced ? undefined : "Create a collection to group products into a curated story."} />}
          />
        )}
      </Card>
      {editing && <CollectionModal key={editing.item?.id ?? "new"} collection={editing.item} onClose={() => setEditing(null)} onCreated={(id) => router.push(`/admin/collections/${id}`)} />}
      {dialog}
    </>
  );
}

function CollectionModal({ collection, onClose, onCreated }: { collection: Collection | null; onClose: () => void; onCreated: (id: number) => void }) {
  const formId = useId();
  const [form, setForm] = useState(() => collectionFormState(collection));
  const save = useAdminMutation(
    (body: ReturnType<typeof collectionPayload>) =>
      collection ? adminApi.patch<{ data: Collection }>(`/admin/collections/${collection.id}`, body) : adminApi.post<{ data: Collection }>("/admin/collections", body),
    {
      success: collection ? "Collection updated" : "Collection created — now add its products",
      invalidate: [COLLECTIONS_KEY],
      onSuccess: (res) => {
        onClose();
        if (!collection) onCreated(res.data.id);
      },
    },
  );

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={collection ? `Edit ${collection.name}` : "New collection"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} loading={save.isPending}>{collection ? "Save changes" : "Create collection"}</Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(collectionPayload(form)); }}>
        <CollectionFields value={form} onChange={setForm} fieldError={save.fieldError} coverPreview={collection?.cover_url} bannerPreview={collection?.banner_url} />
      </form>
    </Modal>
  );
}
