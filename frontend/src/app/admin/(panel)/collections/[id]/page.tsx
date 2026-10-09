"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, GripVertical, Plus, Search, Trash2, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { Badge, Button, Card, EmptyState, ErrorNotice, PageHeader, Spinner, StatusBadge } from "@/components/admin/ui";
import { CollectionFields, collectionFormState, collectionPayload, seasonLabel } from "@/components/admin/catalog/collection-form";
import { Thumb, useDeleteConfirm } from "@/components/admin/catalog/shared";
import type { CollectionDetail, CollectionProduct, ProductListItem } from "@/components/admin/catalog/types";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation, useAdminQuery, useDebounced, useUnsavedChangesWarning, type ListResponse } from "@/lib/admin/hooks";

const COLLECTIONS_KEY = ["admin", "/admin/collections"];

export default function CollectionDetailPage() {
  return (
    <RequirePermission permission={["taxonomy.manage", "products.view"]}>
      <CollectionDetailBody />
    </RequirePermission>
  );
}

function CollectionDetailBody() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const canManage = can("taxonomy.manage");
  const path = `/admin/collections/${params.id}`;
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: CollectionDetail }>(path);
  const { confirmDelete, dialog } = useDeleteConfirm();

  if (isLoading) return <Spinner label="Loading collection" />;
  if (error || !data) {
    return (
      <>
        <PageHeader title="Collection" breadcrumbs={[{ label: "Collections", href: "/admin/collections" }, { label: "Not found" }]} />
        <ErrorNotice error={error} onRetry={() => refetch()} />
      </>
    );
  }
  const c = data.data;

  return (
    <>
      <PageHeader
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {c.is_published ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}
            {c.is_featured && <Badge tone="violet">Featured</Badge>}
            <span>{c.products_count} products · Season: {seasonLabel(c)}</span>
          </span>
        }
        breadcrumbs={[{ label: "Collections", href: "/admin/collections" }, { label: c.name }]}
        actions={
          <>
            <a href={`/collections/${c.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
              <ExternalLink className="h-4 w-4" aria-hidden /> View on site
            </a>
            {canManage && (
              <Button
                variant="secondary"
                onClick={() => confirmDelete({
                  title: `Delete “${c.name}”?`,
                  description: `The ${c.products_count} products in this collection are not deleted — they are only removed from it.`,
                  path,
                  invalidate: [COLLECTIONS_KEY],
                  success: "Collection deleted",
                  onDone: () => router.push("/admin/collections"),
                })}
              >
                <Trash2 className="h-4 w-4 text-red-700" /> Delete
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Curation key={c.id} collection={c} canManage={canManage} path={path} />
        </div>
        <div className="xl:col-span-2">
          <DetailsForm key={c.id} collection={c} canManage={canManage} path={path} />
        </div>
      </div>
      {dialog}
    </>
  );
}

function DetailsForm({ collection, canManage, path }: { collection: CollectionDetail; canManage: boolean; path: string }) {
  const [form, setForm] = useState(() => collectionFormState(collection));
  const save = useAdminMutation((body: ReturnType<typeof collectionPayload>) => adminApi.patch(path, body), {
    success: "Collection saved",
    invalidate: [COLLECTIONS_KEY, ["admin", path]],
  });

  return (
    <Card title="Details" description="Story, imagery, season window and SEO.">
      <form noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(collectionPayload(form)); }}>
        <fieldset disabled={!canManage} className="space-y-6">
          <CollectionFields value={form} onChange={setForm} fieldError={save.fieldError} coverPreview={collection.cover_url} bannerPreview={collection.banner_url} />
          {canManage && (
            <div className="flex justify-end">
              <Button type="submit" loading={save.isPending}>Save details</Button>
            </div>
          )}
        </fieldset>
      </form>
    </Card>
  );
}

function Curation({ collection, canManage, path }: { collection: CollectionDetail; canManage: boolean; path: string }) {
  const [items, setItems] = useState<CollectionProduct[]>(collection.products);
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebounced(q.trim());
  useUnsavedChangesWarning(dirty);

  const search = useAdminQuery<ListResponse<ProductListItem>>(canManage && debounced ? "/admin/products" : null, { q: debounced, per_page: 10 }, { keepPrevious: true });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const save = useAdminMutation((ids: number[]) => adminApi.put<{ data: { count: number } }>(`${path}/products`, { product_ids: ids }), {
    success: (r) => `Collection now has ${r.data.count} products`,
    invalidate: [COLLECTIONS_KEY, ["admin", path]],
    onSuccess: () => setDirty(false),
  });

  const update = (next: CollectionProduct[]) => {
    setItems(next);
    setDirty(true);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from >= 0 && to >= 0) update(arrayMove(items, from, to));
  };
  const inCollection = new Set(items.map((i) => i.id));

  return (
    <Card
      title="Products in this collection"
      description={canManage ? "Drag to set the display order (or focus a handle and use Space + arrow keys). Changes apply when you save." : "Display order on the storefront."}
      actions={canManage ? (
        <div className="flex gap-2">
          {dirty && <Button size="sm" variant="ghost" onClick={() => { setItems(collection.products); setDirty(false); }}>Discard</Button>}
          <Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(items.map((i) => i.id))}>Save order</Button>
        </div>
      ) : undefined}
      padded={false}
    >
      {canManage && (
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products by name or SKU to add…"
              aria-label="Search products to add"
              className="h-10 w-full rounded-md border border-slate-300 pr-9 pl-9 text-sm shadow-sm focus:border-royal focus:ring-2 focus:ring-royal/20 focus:outline-none"
            />
            {q && <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search"><X className="h-4 w-4" /></button>}
          </div>
          {debounced && (
            search.error ? <ErrorNotice error={search.error} /> : search.isLoading ? <Spinner label="Searching" /> : (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200" aria-label="Search results">
                {search.data?.data.map((p) => {
                  const added = inCollection.has(p.id);
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <Thumb url={p.thumb_url} className="h-9 w-9" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.sku ?? "No SKU"}</p>
                      </div>
                      <StatusBadge status={p.status} />
                      <Button size="sm" variant={added ? "ghost" : "secondary"} disabled={added} onClick={() => update([...items, { id: p.id, name: p.name, sku: p.sku, status: p.status, thumb_url: p.thumb_url }])} aria-label={added ? `${p.name} already added` : `Add ${p.name}`}>
                        {added ? "Added" : <><Plus className="h-4 w-4" /> Add</>}
                      </Button>
                    </li>
                  );
                })}
                {search.data?.data.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">No products match “{debounced}”.</li>}
              </ul>
            )
          )}
        </div>
      )}

      {dirty && <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800" role="status">Unsaved changes — click “Save order” to publish this curation.</p>}

      {items.length === 0 ? (
        <EmptyState title="No products yet" description={canManage ? "Search above to add products to this collection." : undefined} />
      ) : canManage ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ol className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <SortableRow key={item.id} item={item} index={index} onRemove={() => update(items.filter((i) => i.id !== item.id))} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <ol className="divide-y divide-slate-100">
          {items.map((item, index) => <ProductRow key={item.id} item={item} index={index} />)}
        </ol>
      )}
    </Card>
  );
}

function ProductRow({ item, index, handle, actions }: { item: CollectionProduct; index: number; handle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {handle}
      <span className="w-6 text-right text-xs text-slate-400 tabular-nums">{index + 1}</span>
      <Thumb url={item.thumb_url} />
      <div className="min-w-0 flex-1">
        <a href={`/admin/products/${item.id}`} className="block truncate text-sm font-medium text-slate-900 hover:underline">{item.name}</a>
        <p className="text-xs text-slate-500">{item.sku ?? "No SKU"}</p>
      </div>
      <StatusBadge status={item.status} />
      {actions}
    </div>
  );
}

function SortableRow({ item, index, onRemove }: { item: CollectionProduct; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "relative z-10 bg-white shadow-md" : "bg-white"}>
      <ProductRow
        item={item}
        index={index}
        handle={
          <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className="cursor-grab touch-none rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing" aria-label={`Drag to reorder ${item.name}`}>
            <GripVertical className="h-4 w-4" />
          </button>
        }
        actions={<Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${item.name} from collection`}><X className="h-4 w-4" /></Button>}
      />
    </li>
  );
}
