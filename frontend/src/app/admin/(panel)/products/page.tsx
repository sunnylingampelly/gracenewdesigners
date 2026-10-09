"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails */
import { useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/admin/guard";
import { useCatalogLookups } from "@/components/admin/products/lookups";
import type { ProductListRow } from "@/components/admin/products/types";
import { Badge, Button, ButtonLink, Card, DataTable, EmptyState, ErrorNotice, Input, PageHeader, Pagination, Select, StatusBadge, Tabs, useConfirm, type Column } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminQuery, useDebounced, useUrlState, type ListResponse } from "@/lib/admin/hooks";
import { downloadFile } from "@/lib/api-client";
import { relativeTime } from "@/lib/utils";

type Counts = { all: number; draft: number; scheduled: number; published: number; archived: number; trashed: number };

export default function ProductsPage() {
  return (
    <RequirePermission permission="products.view">
      <Suspense>
        <ProductList />
      </Suspense>
    </RequirePermission>
  );
}

function ProductList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const lookups = useCatalogLookups();
  const [filters, setFilters] = useUrlState({ status: "", q: "", category_id: "", collection_id: "", stock: "", flag: "", price_mode: "", sort: "updated_desc", page: "1" });
  const [search, setSearch] = useState(filters.q);
  const q = useDebounced(search);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  const query = { ...filters, q, per_page: 25 };
  const { data, isLoading, isFetching, error, refetch } = useAdminQuery<ListResponse<ProductListRow, { counts: Counts }>>("/admin/products", query, { keepPrevious: true });

  useEffect(() => {
    if (q !== filters.q) setFilters({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced search term
  }, [q]);

  const bulk = async (action: string) => {
    setBulkBusy(true);
    try {
      const { data: result } = await adminApi.post<{ data: { updated: number; failed: { id: number; name: string; message: string }[] } }>("/admin/products/bulk", { ids: selected, action });
      if (result.updated) toast.success(`${result.updated} product(s) updated`);
      for (const f of result.failed.slice(0, 3)) toast.error(`${f.name}: ${f.message}`);
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ["admin", "/admin/products"] });
    } finally {
      setBulkBusy(false);
    }
  };

  const counts = data?.meta.counts;
  const columns: Column<ProductListRow>[] = [
    {
      key: "product",
      header: "Product",
      cell: (p) => (
        <div className="flex items-center gap-3">
          {p.thumb_url ? <img src={p.thumb_url} alt="" className="h-12 w-10 shrink-0 rounded object-cover" /> : <span className="h-12 w-10 shrink-0 rounded bg-slate-100" />}
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{p.name}</p>
            <p className="font-mono text-xs text-slate-500">{p.sku}</p>
          </div>
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (p) => <span className="flex flex-wrap gap-1"><StatusBadge status={p.deleted_at ? "trashed" : p.status} />{p.is_live && <Badge tone="green">Live</Badge>}{p.is_featured && <Badge tone="violet">Featured</Badge>}</span> },
    { key: "price", header: "Price", cell: (p) => <span className="whitespace-nowrap">{p.price_label}</span> },
    { key: "categories", header: "Categories", hideOnMobile: true, cell: (p) => <span className="text-xs text-slate-600">{p.categories.join(", ") || "—"}</span> },
    { key: "variants", header: "Variants", hideOnMobile: true, cell: (p) => <span className="text-xs">{p.variant_count}{p.out_of_stock_variants > 0 && <Badge tone="red" className="ml-2">{p.out_of_stock_variants} out</Badge>}</span> },
    { key: "enquiries", header: "Enquiries", hideOnMobile: true, cell: (p) => <span className="tabular-nums">{p.enquiry_count}</span>, className: "text-right" },
    { key: "updated", header: "Updated", hideOnMobile: true, cell: (p) => <span className="text-xs whitespace-nowrap text-slate-500">{relativeTime(p.updated_at)}</span> },
  ];

  const trashed = filters.status === "trashed";

  return (
    <>
      <PageHeader
        title="Products"
        description="Every product, variant and price shown on the storefront comes from here."
        actions={
          <>
            {can("products.import") && (
              <>
                <Button variant="secondary" onClick={() => downloadFile("/admin/products/export").catch(() => toast.error("Export failed"))}><Download className="h-4 w-4" /> Export CSV</Button>
                <ButtonLink href="/admin/products/import" variant="secondary"><Upload className="h-4 w-4" /> Import</ButtonLink>
              </>
            )}
            {can("products.manage") && <ButtonLink href="/admin/products/new"><Plus className="h-4 w-4" /> New product</ButtonLink>}
          </>
        }
      />

      <Card padded={false}>
        <div className="px-4 pt-2">
          <Tabs
            active={filters.status}
            onChange={(status) => { setSelected([]); setFilters({ status }); }}
            tabs={[
              { value: "", label: "All", count: counts?.all },
              { value: "live", label: "Live" },
              { value: "published", label: "Published", count: counts?.published },
              { value: "scheduled", label: "Scheduled", count: counts?.scheduled },
              { value: "draft", label: "Drafts", count: counts?.draft },
              { value: "archived", label: "Archived", count: counts?.archived },
              { value: "trashed", label: "Trash", count: counts?.trashed },
            ]}
          />
        </div>
        <div className="grid gap-2 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <Input aria-label="Search products" placeholder="Search name, SKU or variant SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="lg:col-span-2" />
          <Select aria-label="Category" value={filters.category_id} onChange={(e) => setFilters({ category_id: e.target.value })}>
            <option value="">All categories</option>
            {lookups.categories.map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.depth)}{c.path}</option>)}
          </Select>
          <Select aria-label="Collection" value={filters.collection_id} onChange={(e) => setFilters({ collection_id: e.target.value })}>
            <option value="">All collections</option>
            {lookups.collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select aria-label="Stock" value={filters.stock} onChange={(e) => setFilters({ stock: e.target.value })}>
            <option value="">Any stock</option>
            <option value="out_of_stock">Has out-of-stock variants</option>
            <option value="low_stock">Has low-stock variants</option>
          </Select>
          <Select aria-label="Sort" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>
            <option value="updated_desc">Recently updated</option>
            <option value="created_desc">Newest</option>
            <option value="name">Name</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="enquiries">Most enquired</option>
          </Select>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm">
            <span className="mr-2 font-medium">{selected.length} selected</span>
            {trashed ? (
              can("products.publish") && <Button size="sm" variant="secondary" loading={bulkBusy} onClick={() => bulk("restore")}>Restore</Button>
            ) : (
              <>
                {can("products.publish") && <Button size="sm" variant="secondary" loading={bulkBusy} onClick={() => bulk("publish")}>Publish</Button>}
                {can("products.publish") && <Button size="sm" variant="secondary" loading={bulkBusy} onClick={() => bulk("draft")}>Move to draft</Button>}
                {can("products.publish") && <Button size="sm" variant="secondary" loading={bulkBusy} onClick={() => confirm({ title: `Archive ${selected.length} product(s)?`, description: "Archived products disappear from the storefront and return HTTP 410.", confirmLabel: "Archive", action: () => bulk("archive") })}>Archive</Button>}
                {can("products.manage") && <Button size="sm" variant="secondary" loading={bulkBusy} onClick={() => bulk("feature")}>Feature</Button>}
                {can("products.manage") && <Button size="sm" variant="secondary" loading={bulkBusy} onClick={() => bulk("unfeature")}>Unfeature</Button>}
                {can("products.publish") && <Button size="sm" variant="danger" loading={bulkBusy} onClick={() => confirm({ title: `Move ${selected.length} product(s) to trash?`, description: "They can be restored from the Trash tab.", destructive: true, confirmLabel: "Move to trash", action: () => bulk("delete") })}>Trash</Button>}
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
          </div>
        )}

        {error ? (
          <div className="p-4"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data}
            rowKey={(p) => p.id}
            loading={isLoading || isFetching}
            onRowClick={(p) => router.push(`/admin/products/${p.id}`)}
            selectable={can(["products.publish", "products.manage"])}
            selected={selected}
            onSelectedChange={setSelected}
            empty={
              <EmptyState
                title={filters.q || filters.category_id || filters.stock ? "No products match these filters" : trashed ? "Trash is empty" : "No products yet"}
                description={trashed ? undefined : "Create your first product or import a CSV."}
                action={!trashed && can("products.manage") ? <ButtonLink href="/admin/products/new">New product</ButtonLink> : undefined}
              />
            }
          />
        )}
        {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={(p) => setFilters({ page: String(p) })} />}
      </Card>
      {dialog}
    </>
  );
}
