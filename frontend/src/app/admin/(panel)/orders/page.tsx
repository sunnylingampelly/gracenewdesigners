"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { DebouncedSearch, type OrderRow } from "@/components/admin/sales/shared";
import { useStatusLookups } from "@/components/admin/sales/shared";
import { Button, ButtonLink, Card, DataTable, EmptyState, ErrorNotice, Field, Pagination, PageHeader, Select, Spinner, StatusBadge, type Column } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { useAdminQuery, useUrlState, type ListResponse } from "@/lib/admin/hooks";
import { formatDate, formatDateTime } from "@/lib/utils";

const DEFAULTS = { q: "", status: "", payment_status: "", page: "1" };

export default function OrdersPage() {
  return (
    <RequirePermission permission="orders.view">
      <Suspense fallback={<Spinner />}>
        <OrdersList />
      </Suspense>
    </RequirePermission>
  );
}

function OrdersList() {
  const router = useRouter();
  const { can } = useAuth();
  const { lookups } = useStatusLookups();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const { data, isLoading, isFetching, error, refetch } = useAdminQuery<ListResponse<OrderRow>>("/admin/orders", filters, { keepPrevious: true });
  const filtersActive = !!(filters.q || filters.status || filters.payment_status);

  const columns: Column<OrderRow>[] = [
    { key: "reference", header: "Reference", cell: (r) => <span className="font-medium text-slate-900">{r.reference}</span> },
    { key: "enquiry", header: "Enquiry", hideOnMobile: true, cell: (r) => r.enquiry_reference ?? <span className="text-slate-400">—</span> },
    { key: "customer", header: "Customer", cell: (r) => r.customer ?? <span className="text-slate-400">Not linked</span> },
    { key: "items", header: "Items", hideOnMobile: true, className: "max-w-xs", cell: (r) => <span className="line-clamp-2 text-slate-600">{r.items || "—"}</span> },
    { key: "total", header: "Total", className: "text-right tabular-nums", cell: (r) => r.total_label },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} label={r.status_label} /> },
    { key: "payment", header: "Payment", cell: (r) => <StatusBadge status={r.payment_status} label={r.payment_status_label} /> },
    { key: "created", header: "Created", hideOnMobile: true, cell: (r) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(r.created_at)}</span> },
    { key: "delivery", header: "Expected delivery", hideOnMobile: true, cell: (r) => (r.expected_delivery_date ? <span className="whitespace-nowrap">{formatDate(r.expected_delivery_date)}</span> : <span className="text-slate-400">—</span>) },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        description="Orders recorded manually by the team after confirming details with the customer. Payment and delivery are updated by staff — nothing is inferred."
        actions={can("orders.manage") ? <ButtonLink href="/admin/orders/new"><Plus className="h-4 w-4" aria-hidden /> New order</ButtonLink> : undefined}
      />
      <Card padded={false}>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search" htmlFor="ord-q" className="lg:col-span-2">
            <DebouncedSearch id="ord-q" value={filters.q} onCommit={(q) => setFilters({ q })} placeholder="Reference, customer name or phone, product…" />
          </Field>
          <Field label="Status" htmlFor="ord-status">
            <Select id="ord-status" value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}>
              <option value="">All statuses</option>
              {lookups?.order.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Payment" htmlFor="ord-pay">
            <Select id="ord-pay" value={filters.payment_status} onChange={(e) => setFilters({ payment_status: e.target.value })}>
              <option value="">All payment statuses</option>
              {lookups?.payment.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          {filtersActive && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Button variant="ghost" size="sm" onClick={() => setFilters({ q: "", status: "", payment_status: "" })}><X className="h-3.5 w-3.5" aria-hidden /> Clear filters</Button>
            </div>
          )}
        </div>
        {error ? (
          <div className="p-4"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data}
            rowKey={(r) => r.id}
            loading={isLoading || isFetching}
            onRowClick={(r) => router.push(`/admin/orders/${r.id}`)}
            empty={<EmptyState title={filtersActive ? "No orders match" : "No orders yet"} description={filtersActive ? "Try clearing the filters." : "Create an order from an enquiry once the customer has confirmed, or record one directly."} action={!filtersActive && can("orders.manage") ? <ButtonLink href="/admin/orders/new">New order</ButtonLink> : undefined} />}
          />
        )}
        {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={(p) => setFilters({ page: String(p) })} />}
      </Card>
    </>
  );
}
