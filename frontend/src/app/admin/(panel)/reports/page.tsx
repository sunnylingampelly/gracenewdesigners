"use client";

import { Suspense } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { BarList, ChartTable, ColumnChart, type ColumnDatum } from "@/components/admin/system/charts";
import { asRecord, formatCount, humanize } from "@/components/admin/system/format";
import { Card, ErrorNotice, PageHeader, Spinner } from "@/components/admin/ui";
import { useAdminQuery, useUrlState } from "@/lib/admin/hooks";
import { cn, formatDate, formatMoney } from "@/lib/utils";

type Reports = {
  range_days: number;
  enquiries_by_day: { date: string; count: number }[];
  enquiries_by_status: Record<string, number> | [];
  enquiries_by_type: Record<string, number> | [];
  enquiries_by_source: Record<string, number> | [];
  orders: { recorded: number; confirmed: number; confirmed_value: number; from_enquiries: number };
  enquiry_to_order_rate: number | null;
};

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "12 months" },
];

const STATUS_ORDER = ["new", "contacted", "awaiting_response", "qualified", "order_confirmed", "completed", "lost", "spam"];
const TYPE_LABELS: Record<string, string> = { product: "Product enquiry", bag: "Enquiry bag", consultation: "Consultation", contact: "Contact form" };

export default function ReportsPage() {
  return (
    <RequirePermission permission="reports.view">
      <Suspense fallback={<Spinner />}>
        <ReportsBody />
      </Suspense>
    </RequirePermission>
  );
}

function ReportsBody() {
  const [state, setState] = useUrlState({ days: "30" });
  const days = RANGES.some((r) => r.value === state.days) ? state.days : "30";
  const { data, isLoading, isFetching, error, refetch } = useAdminQuery<{ data: Reports }>("/admin/reports", { days }, { keepPrevious: true });

  return (
    <>
      <PageHeader
        title="Reports"
        description="Enquiry demand measured on the website, alongside orders your team has confirmed."
        actions={
          <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 shadow-sm">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={days === r.value}
                onClick={() => setState({ days: r.value })}
                className={cn("rounded px-3 py-1.5 text-sm whitespace-nowrap transition-colors", days === r.value ? "bg-slate-900 font-medium text-white" : "text-slate-600 hover:bg-slate-100")}
              >
                <span className="sr-only">Last </span>{r.label}
              </button>
            ))}
          </div>
        }
      />
      {isLoading ? <Spinner label="Loading reports" /> : error || !data ? <ErrorNotice error={error} onRetry={() => refetch()} /> : (
        <div className={cn("space-y-6 transition-opacity", isFetching && "opacity-60")} aria-busy={isFetching}>
          <ReportContent r={data.data} />
        </div>
      )}
    </>
  );
}

function bucket(days: { date: string; count: number }[], range: number): { data: ColumnDatum[]; per: string } {
  if (range <= 31) {
    return {
      per: "day",
      data: days.map((d) => ({ key: d.date, tick: formatDate(d.date, { day: "numeric", month: "short" }), label: formatDate(d.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }), value: d.count })),
    };
  }
  if (range <= 120) {
    const weeks: ColumnDatum[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      const first = chunk[0].date;
      const last = chunk[chunk.length - 1].date;
      weeks.push({ key: first, tick: formatDate(first, { day: "numeric", month: "short" }), label: `${formatDate(first, { day: "numeric", month: "short" })} – ${formatDate(last, { day: "numeric", month: "short", year: "numeric" })}`, value: chunk.reduce((s, d) => s + d.count, 0) });
    }
    return { per: "week", data: weeks };
  }
  const months = new Map<string, ColumnDatum>();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    const existing = months.get(key);
    if (existing) existing.value += d.count;
    else months.set(key, { key, tick: formatDate(d.date, { month: "short", year: "2-digit" }), label: formatDate(d.date, { month: "long", year: "numeric" }), value: d.count });
  }
  return { per: "month", data: [...months.values()] };
}

function sortedEntries(record: Record<string, number>, order?: string[]) {
  const entries = Object.entries(record);
  if (order) return entries.sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  return entries.sort(([, a], [, b]) => b - a);
}

function ReportContent({ r }: { r: Reports }) {
  const total = r.enquiries_by_day.reduce((s, d) => s + d.count, 0);
  const { data: series, per } = bucket(r.enquiries_by_day, r.range_days);
  const status = sortedEntries(asRecord(r.enquiries_by_status), STATUS_ORDER).map(([k, v]) => ({ key: k, label: humanize(k), value: v }));
  const type = sortedEntries(asRecord(r.enquiries_by_type)).map(([k, v]) => ({ key: k, label: TYPE_LABELS[k] ?? humanize(k), value: v }));
  const source = sortedEntries(asRecord(r.enquiries_by_source)).map(([k, v]) => ({ key: k, label: k, value: v }));
  const peak = series.reduce<ColumnDatum | null>((best, d) => (!best || d.value > best.value ? d : best), null);
  const rangeLabel = RANGES.find((x) => Number(x.value) === r.range_days)?.label ?? `${r.range_days} days`;
  const unit: [string, string] = ["enquiry", "enquiries"];

  return (
    <>
      <section aria-labelledby="measured-heading" className="space-y-4">
        <SectionHeading id="measured-heading" tag="Measured" title="Website enquiry intents" note="Counted when a visitor starts a WhatsApp enquiry or submits a form on the site. An intent is interest, not a sale — the chat may not have happened or led to an order." />
        <Card title={`Enquiries per ${per}`} description={`${formatCount(total)} ${total === 1 ? "enquiry" : "enquiries"} in the last ${rangeLabel} (including any later marked as spam).`}>
          {total === 0 && <p className="mb-2 text-sm text-slate-500">No enquiries were recorded in this period.</p>}
          <ColumnChart
            data={series}
            unit={unit}
            summary={`Column chart of enquiries per ${per} over the last ${rangeLabel}. Total ${total}.${peak && peak.value > 0 ? ` Highest: ${peak.value} on ${peak.label}.` : ""}`}
          />
          <ChartTable caption={`Enquiries per ${per}`} columns={[per === "day" ? "Date" : per === "week" ? "Week" : "Month", "Enquiries"]} rows={series.map((d) => ({ key: d.key, label: d.label, value: formatCount(d.value) }))} />
        </Card>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="By status" description="Where these enquiries are in your pipeline now.">
            <BarList items={status} unit={unit} />
          </Card>
          <Card title="By type">
            <BarList items={type} unit={unit} />
          </Card>
          <Card title="By source" description="Campaign (UTM) source or referring site. Top 10.">
            <BarList items={source} unit={unit} />
          </Card>
        </div>
      </section>

      <section aria-labelledby="confirmed-heading" className="space-y-4">
        <SectionHeading id="confirmed-heading" tag="Confirmed" title="Orders recorded by staff" note="Only orders your team records in the admin. Cancelled orders are excluded from confirmed figures. WhatsApp clicks are never counted as purchases." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Orders recorded" value={formatCount(r.orders.recorded)} sub="Created in this period" />
          <Stat label="Orders confirmed" value={formatCount(r.orders.confirmed)} sub="Confirmed and not cancelled" />
          <Stat label="Confirmed value" value={formatMoney(r.orders.confirmed_value)} sub="Total of confirmed orders" />
          <Stat label="Confirmed from enquiries" value={formatCount(r.orders.from_enquiries)} sub="Linked to a website enquiry" />
          <Stat
            label="Enquiry → order rate"
            value={r.enquiry_to_order_rate === null ? "—" : `${r.enquiry_to_order_rate}%`}
            sub={r.enquiry_to_order_rate === null ? "No non-spam enquiries yet" : "Confirmed orders from enquiries ÷ non-spam enquiries"}
          />
        </div>
      </section>
    </>
  );
}

function SectionHeading({ id, tag, title, note }: { id: string; tag: string; title: string; note: string }) {
  return (
    <div>
      <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase">{tag}</span>
        {tag} ({title.charAt(0).toLowerCase() + title.slice(1)})
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">{note}</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
