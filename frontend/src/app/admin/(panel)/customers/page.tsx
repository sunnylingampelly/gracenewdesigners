"use client";

import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { DebouncedSearch, type CustomerRow } from "@/components/admin/sales/shared";
import { Badge, Card, DataTable, EmptyState, ErrorNotice, Field, Pagination, PageHeader, Spinner, Tabs, type Column } from "@/components/admin/ui";
import { useAdminQuery, useUrlState, type ListResponse } from "@/lib/admin/hooks";
import { formatDate, formatDateTime } from "@/lib/utils";

type Subscriber = { id: number; email: string; source: string | null; consented_at: string };

const DEFAULTS = { tab: "customers", q: "", page: "1" };

export default function CustomersPage() {
  return (
    <RequirePermission permission="customers.view">
      <Suspense fallback={<Spinner />}>
        <CustomersBody />
      </Suspense>
    </RequirePermission>
  );
}

function CustomersBody() {
  const [state, setState] = useUrlState(DEFAULTS);
  return (
    <>
      <PageHeader title="Customers & contacts" description="People who supplied contact details with an enquiry or were linked to an order, plus newsletter subscribers." />
      <Card padded={false}>
        <div className="px-4 pt-2">
          <Tabs tabs={[{ value: "customers", label: "Customers" }, { value: "subscribers", label: "Newsletter subscribers" }]} active={state.tab} onChange={(tab) => setState({ tab, q: "" })} />
        </div>
        {state.tab === "subscribers" ? <Subscribers page={state.page} onPage={(p) => setState({ page: String(p) })} /> : <Customers q={state.q} page={state.page} setState={setState} />}
      </Card>
    </>
  );
}

function Customers({ q, page, setState }: { q: string; page: string; setState: (p: Partial<typeof DEFAULTS>) => void }) {
  const router = useRouter();
  const { data, isLoading, isFetching, error, refetch } = useAdminQuery<ListResponse<CustomerRow>>("/admin/customers", { q, page }, { keepPrevious: true });
  const columns: Column<CustomerRow>[] = [
    { key: "name", header: "Name", cell: (c) => <span className="font-medium text-slate-900">{c.name ?? <span className="font-normal text-slate-400">Not supplied</span>}</span> },
    { key: "phone", header: "Phone", cell: (c) => c.phone ?? <span className="text-slate-400">—</span> },
    { key: "email", header: "Email", cell: (c) => (c.email ? <span className="break-all">{c.email}</span> : <span className="text-slate-400">—</span>) },
    { key: "city", header: "City", hideOnMobile: true, cell: (c) => [c.city, c.country].filter(Boolean).join(", ") || <span className="text-slate-400">—</span> },
    { key: "enquiries", header: "Enquiries", className: "text-right tabular-nums", cell: (c) => c.enquiries_count },
    { key: "orders", header: "Orders", className: "text-right tabular-nums", cell: (c) => c.orders_count },
    { key: "consent", header: "Marketing", hideOnMobile: true, cell: (c) => (c.marketing_consent ? <Badge tone="green">Consented</Badge> : <Badge>No</Badge>) },
    { key: "created", header: "Created", hideOnMobile: true, cell: (c) => <span className="whitespace-nowrap text-slate-600">{formatDate(c.created_at)}</span> },
  ];
  return (
    <>
      <div className="border-b border-slate-100 p-4">
        <Field label="Search" htmlFor="cust-q" className="max-w-md">
          <DebouncedSearch id="cust-q" value={q} onCommit={(v) => setState({ q: v })} placeholder="Name, phone or email…" />
        </Field>
      </div>
      {error ? (
        <div className="p-4"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
      ) : (
        <DataTable columns={columns} rows={data?.data} rowKey={(c) => c.id} loading={isLoading || isFetching} onRowClick={(c) => router.push(`/admin/customers/${c.id}`)} empty={<EmptyState title={q ? "No customers match" : "No customers yet"} description={q ? "Try a different name, phone or email." : "Customers are created when visitors share contact details with an enquiry."} />} />
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={(p) => setState({ page: String(p) })} />}
    </>
  );
}

function Subscribers({ page, onPage }: { page: string; onPage: (p: number) => void }) {
  const { data, isLoading, isFetching, error, refetch } = useAdminQuery<{ data: Subscriber[]; meta: { current_page: number; last_page: number; total: number } }>("/admin/newsletter-subscribers", { page }, { keepPrevious: true });
  const columns: Column<Subscriber>[] = [
    { key: "email", header: "Email", cell: (s) => <span className="break-all text-slate-900">{s.email}</span> },
    { key: "source", header: "Source", cell: (s) => s.source ?? <span className="text-slate-400">—</span> },
    { key: "consented", header: "Consented", cell: (s) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(s.consented_at)}</span> },
  ];
  return (
    <>
      <p className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">Active subscribers who opted in to the newsletter. Unsubscribed addresses are not listed.</p>
      {error ? (
        <div className="p-4"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
      ) : (
        <DataTable columns={columns} rows={data?.data} rowKey={(s) => s.id} loading={isLoading || isFetching} empty={<EmptyState title="No subscribers yet" />} />
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={onPage} />}
    </>
  );
}
