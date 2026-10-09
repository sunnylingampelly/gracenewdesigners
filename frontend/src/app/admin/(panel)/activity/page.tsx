"use client";

import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Fragment, Suspense, useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { humanize } from "@/components/admin/system/format";
import { Badge, Card, EmptyState, ErrorNotice, Field, Input, PageHeader, Pagination, Select, Spinner } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { useAdminQuery, useDebounced, useUrlState } from "@/lib/admin/hooks";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

type LogEntry = { id: number; action: string; description: string; subject_type: string | null; subject_id: number | null; changes: unknown; user: string; created_at: string };
type LogResponse = { data: LogEntry[]; meta: { current_page: number; last_page: number; total: number } };

const ACTION_AREAS = ["product", "category", "collection", "occasion", "department", "attribute", "media", "enquiry", "order", "customer", "homepage", "page", "lookbook", "navigation", "settings", "user", "role", "auth"];
const SUBJECT_TYPES = ["Product", "Category", "Collection", "Occasion", "Department", "Attribute", "MediaAsset", "Enquiry", "Order", "Customer", "Page", "Lookbook", "NavigationMenu", "User", "Role"];

export default function ActivityPage() {
  return (
    <RequirePermission permission="activity.view">
      <PageHeader title="Activity log" description="An audit trail of changes made in the admin — who did what, and when." />
      <Suspense fallback={<Spinner />}>
        <ActivityList />
      </Suspense>
    </RequirePermission>
  );
}

function useTeamOptions() {
  const { can } = useAuth();
  const path = can("users.manage") ? "/admin/users" : can(["enquiries.view", "orders.view"]) ? "/admin/team/assignees" : null;
  const { data } = useAdminQuery<{ data: { id: number; name: string }[] }>(path);
  return data?.data ?? null;
}

function ActivityList() {
  const [filters, setFilters] = useUrlState({ q: "", action: "", subject_type: "", user_id: "", page: "1" });
  const [q, setQ] = useState(filters.q);
  const debouncedQ = useDebounced(q);
  const team = useTeamOptions();
  const [expanded, setExpanded] = useState<number[]>([]);

  const needsSync = debouncedQ !== filters.q;
  useEffect(() => {
    if (needsSync) setFilters({ q: debouncedQ });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setFilters is recreated each render
  }, [needsSync, debouncedQ]);

  const page = Number(filters.page) || 1;
  const { data, isLoading, isFetching, error, refetch } = useAdminQuery<LogResponse>(
    "/admin/activity-logs",
    { q: filters.q, action: filters.action, subject_type: filters.subject_type, user_id: filters.user_id, page },
    { keepPrevious: true },
  );
  const toggle = (id: number) => setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  return (
    <Card padded={false}>
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Search" htmlFor="act-q">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input id="act-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search descriptions" className="pl-9" />
          </div>
        </Field>
        <Field label="Action" htmlFor="act-action">
          <Select id="act-action" value={filters.action} onChange={(e) => setFilters({ action: e.target.value })}>
            <option value="">All actions</option>
            {ACTION_AREAS.map((a) => <option key={a} value={`${a}.`}>{humanize(a)}</option>)}
          </Select>
        </Field>
        <Field label="Record type" htmlFor="act-subject">
          <Select id="act-subject" value={filters.subject_type} onChange={(e) => setFilters({ subject_type: e.target.value })}>
            <option value="">All records</option>
            {SUBJECT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/([a-z])([A-Z])/g, "$1 $2")}</option>)}
          </Select>
        </Field>
        {team && (
          <Field label="Team member" htmlFor="act-user">
            <Select id="act-user" value={filters.user_id} onChange={(e) => setFilters({ user_id: e.target.value })}>
              <option value="">Everyone</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
        )}
      </div>

      {error ? (
        <div className="p-4"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
      ) : isLoading ? (
        <Spinner label="Loading activity" />
      ) : !data?.data.length ? (
        <EmptyState title="No activity found" description={filters.q || filters.action || filters.subject_type || filters.user_id ? "Try clearing the filters." : "Changes made in the admin will appear here."} />
      ) : (
        <div className={cn("overflow-x-auto", isFetching && "opacity-60")}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th scope="col" className="w-8 px-3 py-3"><span className="sr-only">Details</span></th>
                <th scope="col" className="px-3 py-3 font-medium">When</th>
                <th scope="col" className="px-3 py-3 font-medium">Who</th>
                <th scope="col" className="hidden px-3 py-3 font-medium md:table-cell">Action</th>
                <th scope="col" className="px-3 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((entry) => {
                const hasChanges = entry.changes !== null && entry.changes !== undefined && !(Array.isArray(entry.changes) && entry.changes.length === 0);
                const open = expanded.includes(entry.id);
                return (
                  <Fragment key={entry.id}>
                    <tr className="align-top">
                      <td className="px-3 py-3">
                        {hasChanges && (
                          <button type="button" onClick={() => toggle(entry.id)} aria-expanded={open} aria-controls={`changes-${entry.id}`} aria-label={open ? "Hide changes" : "Show changes"} className="rounded p-0.5 text-slate-500 hover:bg-slate-100">
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="block text-slate-800">{relativeTime(entry.created_at)}</span>
                        <span className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-700">{entry.user}</td>
                      <td className="hidden px-3 py-3 md:table-cell"><Badge>{entry.action}</Badge></td>
                      <td className="px-3 py-3 text-slate-800">
                        {entry.description}
                        {entry.subject_type && <span className="block text-xs text-slate-500">{entry.subject_type}{entry.subject_id ? ` #${entry.subject_id}` : ""}</span>}
                      </td>
                    </tr>
                    {open && hasChanges && (
                      <tr id={`changes-${entry.id}`} className="bg-slate-50/70">
                        <td />
                        <td colSpan={4} className="px-3 pb-4">
                          <ChangesView changes={entry.changes} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={(p) => setFilters({ page: String(p) })} />}
    </Card>
  );
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 1);
  return String(value);
}

function isDiff(v: unknown): v is { from: unknown; to: unknown } {
  return !!v && typeof v === "object" && !Array.isArray(v) && ("from" in v || "to" in v);
}

function ChangesView({ changes }: { changes: unknown }) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return <pre className="overflow-x-auto rounded-md bg-white p-3 text-xs whitespace-pre-wrap text-slate-700">{display(changes)}</pre>;
  }
  const entries = Object.entries(changes as Record<string, unknown>);
  return (
    <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-xs">
      <caption className="sr-only">Changed fields</caption>
      <thead className="bg-slate-50 text-slate-500">
        <tr>
          <th scope="col" className="px-3 py-2 text-left font-medium">Field</th>
          <th scope="col" className="px-3 py-2 text-left font-medium">From</th>
          <th scope="col" className="px-3 py-2 text-left font-medium">To</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {entries.map(([field, value]) => (
          <tr key={field} className="align-top">
            <th scope="row" className="px-3 py-2 text-left font-medium text-slate-700">{humanize(field)}</th>
            {isDiff(value) ? (
              <>
                <td className="px-3 py-2"><span className="rounded bg-red-50 px-1 break-all whitespace-pre-wrap text-red-800"><span className="sr-only">Before: </span>{display(value.from)}</span></td>
                <td className="px-3 py-2"><span className="rounded bg-emerald-50 px-1 break-all whitespace-pre-wrap text-emerald-800"><span className="sr-only">After: </span>{display(value.to)}</span></td>
              </>
            ) : (
              <td colSpan={2} className="px-3 py-2 break-all whitespace-pre-wrap text-slate-700">{display(value)}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
