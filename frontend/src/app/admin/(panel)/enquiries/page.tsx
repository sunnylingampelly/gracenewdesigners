"use client";

import { Download, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/admin/guard";
import { DebouncedSearch, HandoffBadge, contactOf, ENQUIRY_TYPES, labelFor, useAssignees, useStatusLookups, type EnquiryRow } from "@/components/admin/sales/shared";
import { Button, Card, DataTable, EmptyState, ErrorNotice, Field, Input, Pagination, PageHeader, Select, Spinner, StatusBadge, Tabs, useConfirm, type Column } from "@/components/admin/ui";
import { downloadFile } from "@/lib/api-client";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation, useAdminQuery, useUrlState, type ListResponse } from "@/lib/admin/hooks";
import { formatDateTime } from "@/lib/utils";

type Counts = { new: number; open: number; overdue: number };

const STATUS_TABS: { value: string; label: string; countKey?: keyof Counts }[] = [
  { value: "open", label: "Open", countKey: "open" },
  { value: "new", label: "New", countKey: "new" },
  { value: "contacted", label: "Contacted" },
  { value: "awaiting_response", label: "Awaiting Response" },
  { value: "qualified", label: "Qualified" },
  { value: "order_confirmed", label: "Order Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "lost", label: "Lost" },
  { value: "spam", label: "Spam" },
  { value: "all", label: "All" },
];

const DEFAULTS = { status: "open", q: "", type: "", assigned_to: "", follow_up: "", from: "", to: "", page: "1" };

export default function EnquiriesPage() {
  return (
    <RequirePermission permission="enquiries.view">
      <Suspense fallback={<Spinner />}>
        <EnquiriesInbox />
      </Suspense>
    </RequirePermission>
  );
}

function EnquiriesInbox() {
  const router = useRouter();
  const { can } = useAuth();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [exporting, setExporting] = useState(false);
  const { assignees } = useAssignees();

  const apiFilters = {
    q: filters.q,
    status: filters.status === "all" ? "" : filters.status,
    type: filters.type,
    assigned_to: filters.assigned_to,
    follow_up: filters.follow_up,
    from: filters.from,
    to: filters.to,
  };
  const { data, isLoading, isFetching, error, refetch } = useAdminQuery<ListResponse<EnquiryRow, { counts?: Counts }>>("/admin/enquiries", { ...apiFilters, page: filters.page }, { keepPrevious: true });
  const counts = data?.meta.counts;
  const filtersActive = !!(filters.q || filters.type || filters.assigned_to || filters.follow_up || filters.from || filters.to);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile("/admin/enquiries/export", apiFilters);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The export could not be generated.");
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<EnquiryRow>[] = [
    {
      key: "reference",
      header: "Reference",
      cell: (r) => (
        <div>
          <span className="font-medium text-slate-900">{r.reference}</span>
          <div className="mt-0.5"><HandoffBadge at={r.redirect_initiated_at} /></div>
        </div>
      ),
    },
    { key: "date", header: "Date (IST)", cell: (r) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(r.created_at)}</span> },
    {
      key: "product",
      header: "Product",
      cell: (r) => (
        <span>
          {r.product ?? <span className="text-slate-400">{labelFor(ENQUIRY_TYPES, r.type)}</span>}
          {r.item_count > 1 && <span className="ml-1 text-xs text-slate-500">+{r.item_count - 1} more</span>}
        </span>
      ),
    },
    { key: "variant", header: "Variant", hideOnMobile: true, cell: (r) => r.variant ?? <span className="text-slate-400">—</span> },
    { key: "qty", header: "Qty", hideOnMobile: true, className: "text-right tabular-nums", cell: (r) => r.quantity || "—" },
    { key: "source", header: "Lead source", hideOnMobile: true, cell: (r) => r.lead_source ?? <span className="text-slate-400">Unknown</span> },
    {
      key: "contact",
      header: "Contact",
      cell: (r) => {
        const c = contactOf(r.contact);
        if (!c) return <span className="text-slate-400">Not supplied</span>;
        return (
          <div className="min-w-0 text-xs leading-5">
            {c.name && <div className="text-sm text-slate-900">{c.name}</div>}
            {c.phone && <div className="text-slate-600">{c.phone}</div>}
            {c.email && <div className="truncate text-slate-500">{c.email}</div>}
          </div>
        );
      },
    },
    { key: "assigned", header: "Assigned to", hideOnMobile: true, cell: (r) => r.assigned_to?.name ?? <span className="text-slate-400">Unassigned</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} label={r.status_label} /> },
    {
      key: "follow_up",
      header: "Follow-up",
      cell: (r) =>
        r.follow_up_at ? (
          <span className={r.is_overdue ? "font-medium whitespace-nowrap text-red-700" : "whitespace-nowrap text-slate-600"}>
            {formatDateTime(r.follow_up_at)}
            {r.is_overdue && <span className="block text-xs">Overdue</span>}
          </span>
        ) : <span className="text-slate-400">—</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Enquiry intents saved on the website before the customer was handed off to WhatsApp. A saved enquiry does not mean a message was sent — confirm with the customer."
        actions={can("enquiries.export") ? <Button variant="secondary" onClick={exportCsv} loading={exporting}><Download className="h-4 w-4" aria-hidden /> Export CSV</Button> : undefined}
      />

      <Card padded={false}>
        <div className="px-4 pt-2">
          <Tabs
            tabs={STATUS_TABS.map((t) => ({ value: t.value, label: t.label, count: t.countKey ? counts?.[t.countKey] : undefined }))}
            active={filters.status}
            onChange={(status) => { setSelected([]); setFilters({ status }); }}
          />
        </div>

        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Search" htmlFor="enq-q" className="lg:col-span-2">
            <DebouncedSearch id="enq-q" value={filters.q} onCommit={(q) => setFilters({ q })} placeholder="Reference, name, phone, email, product…" />
          </Field>
          <Field label="Type" htmlFor="enq-type">
            <Select id="enq-type" value={filters.type} onChange={(e) => setFilters({ type: e.target.value })}>
              <option value="">All types</option>
              {ENQUIRY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Assigned to" htmlFor="enq-assigned">
            <Select id="enq-assigned" value={filters.assigned_to} onChange={(e) => setFilters({ assigned_to: e.target.value })}>
              <option value="">Anyone</option>
              <option value="unassigned">Unassigned</option>
              {assignees.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label={<>Follow-up{counts?.overdue ? <span className="ml-1 text-xs font-normal text-red-700">({counts.overdue} overdue)</span> : null}</>} htmlFor="enq-follow">
            <Select id="enq-follow" value={filters.follow_up} onChange={(e) => setFilters({ follow_up: e.target.value })}>
              <option value="">Any</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="upcoming">Upcoming</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From" htmlFor="enq-from">
              <Input id="enq-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilters({ from: e.target.value })} />
            </Field>
            <Field label="To" htmlFor="enq-to">
              <Input id="enq-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ to: e.target.value })} />
            </Field>
          </div>
          {filtersActive && (
            <div className="sm:col-span-2 lg:col-span-6">
              <Button variant="ghost" size="sm" onClick={() => { setFilters({ q: "", type: "", assigned_to: "", follow_up: "", from: "", to: "" }); }}>
                <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
              </Button>
            </div>
          )}
        </div>

        {can("enquiries.manage") && selected.length > 0 && (
          <BulkBar ids={selected.map(Number)} onDone={() => setSelected([])} assignees={assignees} />
        )}

        {error ? (
          <div className="p-4"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.data}
            rowKey={(r) => r.id}
            loading={isLoading || isFetching}
            onRowClick={(r) => router.push(`/admin/enquiries/${r.id}`)}
            selectable={can("enquiries.manage")}
            selected={selected}
            onSelectedChange={setSelected}
            empty={<EmptyState title="No enquiries match" description={filtersActive || filters.status !== "all" ? "Try another status tab or clear the filters." : "Enquiries appear here when visitors start a WhatsApp enquiry on the site."} />}
          />
        )}
        {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={(p) => { setSelected([]); setFilters({ page: String(p) }); }} />}
      </Card>
    </>
  );
}

function BulkBar({ ids, onDone, assignees }: { ids: number[]; onDone: () => void; assignees: { id: number; name: string }[] }) {
  const { lookups } = useStatusLookups();
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
  const { confirm, dialog } = useConfirm();
  const bulk = useAdminMutation((body: Record<string, unknown>) => adminApi.post<{ data: { updated: number } }>("/admin/enquiries/bulk", { ids, ...body }), {
    success: (r) => `${r.data.updated} enquir${r.data.updated === 1 ? "y" : "ies"} updated`,
    invalidate: [["admin", "/admin/enquiries"]],
    onSuccess: () => { setStatus(""); setAssignee(""); onDone(); },
  });

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3" role="region" aria-label="Bulk actions">
      <p className="self-center text-sm font-medium text-slate-700">{ids.length} selected</p>
      <div className="flex items-end gap-2">
        <Field label="Change status" htmlFor="bulk-status">
          <Select id="bulk-status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 text-xs">
            <option value="">Choose…</option>
            {lookups?.enquiry.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Button size="sm" disabled={!status} loading={bulk.isPending} onClick={() => confirm({
          title: `Change ${ids.length} enquiries to “${labelFor(lookups?.enquiry, status)}”?`,
          description: "Each enquiry records the change in its status history.",
          confirmLabel: "Change status",
          action: () => bulk.mutateAsync({ status }),
        })}>Apply</Button>
      </div>
      <div className="flex items-end gap-2">
        <Field label="Assign to" htmlFor="bulk-assign">
          <Select id="bulk-assign" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-8 text-xs">
            <option value="">Choose…</option>
            <option value="none">Unassign</option>
            {assignees.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
          </Select>
        </Field>
        <Button size="sm" disabled={!assignee} loading={bulk.isPending} onClick={() => bulk.mutate({ assigned_to: assignee === "none" ? null : Number(assignee) })}>Apply</Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onDone} className="ml-auto">Clear selection</Button>
      {dialog}
    </div>
  );
}
