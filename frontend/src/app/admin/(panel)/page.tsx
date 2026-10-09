"use client";

import { AlertTriangle, Eye, Inbox, MessageCircle, Package, ShoppingBag } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { ButtonLink, Card, ErrorNotice, PageHeader, Spinner } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { useAdminQuery } from "@/lib/admin/hooks";
import { relativeTime } from "@/lib/utils";

type Dashboard = {
  catalogue: { live_products: number; published_products: number; scheduled_products: number; draft_products: number; out_of_stock_variants: number; low_stock_variants: number };
  measured: { note: string; enquiry_intents_today: number; enquiry_intents_month: number; most_viewed_products: { id: number; name: string; views: number }[]; most_enquired_products: { id: number; name: string; enquiries: number }[] };
  pipeline: { new_leads: number; awaiting_follow_up: number; overdue_follow_ups: number };
  confirmed: { note: string; orders_confirmed_month: number; orders_in_progress: number; confirmed_value_month: string; payments_recorded_month: string };
  recent_catalogue_changes: { description: string; user: string | null; created_at: string }[];
};

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <RequirePermission permission="reports.view">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description="Today at the studio — catalogue health, enquiry pipeline and confirmed orders." />
      <DashboardBody />
    </RequirePermission>
  );
}

function DashboardBody() {
  const { can } = useAuth();
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: Dashboard }>("/admin/dashboard", {}, { refetchInterval: 60_000 });
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNotice error={error} onRetry={() => refetch()} />;
  const d = data.data;

  return (
    <div className="space-y-6">
      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<Package className="h-4 w-4" />} label="Live products" value={d.catalogue.live_products} sub={`${d.catalogue.draft_products} drafts · ${d.catalogue.scheduled_products} scheduled`} href="/admin/products?status=live" />
        <Kpi icon={<Inbox className="h-4 w-4" />} label="Enquiry intents today" value={d.measured.enquiry_intents_today} sub={`${d.measured.enquiry_intents_month} this month`} href={can("enquiries.view") ? "/admin/enquiries" : undefined} tag="Measured" />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Leads awaiting follow-up" value={d.pipeline.awaiting_follow_up} sub={`${d.pipeline.new_leads} new · ${d.pipeline.overdue_follow_ups} overdue`} href={can("enquiries.view") ? "/admin/enquiries?status=open" : undefined} tone={d.pipeline.overdue_follow_ups > 0 ? "warn" : undefined} />
        <Kpi icon={<ShoppingBag className="h-4 w-4" />} label="Orders confirmed this month" value={d.confirmed.orders_confirmed_month} sub={`${d.confirmed.confirmed_value_month} confirmed value`} href={can("orders.view") ? "/admin/orders" : undefined} tag="Confirmed" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Catalogue health" className="lg:col-span-1">
          <ul className="space-y-3 text-sm">
            <Row label="Published products" value={d.catalogue.published_products} />
            <Row label="Draft products" value={d.catalogue.draft_products} href="/admin/products?status=draft" />
            <Row label="Out-of-stock variants (live products)" value={d.catalogue.out_of_stock_variants} href="/admin/products?stock=out_of_stock" warn={d.catalogue.out_of_stock_variants > 0} />
            <Row label="Low-stock variants" value={d.catalogue.low_stock_variants} href="/admin/products?stock=low_stock" />
          </ul>
        </Card>

        <Card title="Most enquired (30 days)" description="Measured from WhatsApp handoffs started on the site.">
          <RankList icon="enquiries" items={d.measured.most_enquired_products.map((p) => ({ id: p.id, name: p.name, value: `${p.enquiries}` }))} empty="No enquiries yet." />
        </Card>

        <Card title="Most viewed" description="Measured product page views (consented visitors).">
          <RankList icon="views" items={d.measured.most_viewed_products.map((p) => ({ id: p.id, name: p.name, value: `${p.views}` }))} empty="No views recorded yet." />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Confirmed business" description={d.confirmed.note}>
          <ul className="space-y-3 text-sm">
            <Row label="Orders in progress" value={d.confirmed.orders_in_progress} />
            <Row label="Confirmed order value (this month)" value={d.confirmed.confirmed_value_month} />
            <Row label="Payments recorded by staff (this month)" value={d.confirmed.payments_recorded_month} />
          </ul>
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-500">{d.measured.note}</p>
        </Card>
        <Card title="Recent catalogue changes" actions={can("activity.view") ? <Link href="/admin/activity" className="text-xs text-royal hover:underline">All activity</Link> : undefined}>
          {d.recent_catalogue_changes.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {d.recent_catalogue_changes.map((c, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-2">
                  <span>{c.description}</span>
                  <span className="shrink-0 text-xs text-slate-400">{c.user ?? "System"} · {relativeTime(c.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">No changes yet.</p>}
        </Card>
      </div>

      {can("products.manage") && (
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/products/new">Add product</ButtonLink>
          {can("content.manage") && <ButtonLink href="/admin/homepage" variant="secondary">Edit homepage</ButtonLink>}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, sub, href, tag, tone }: { icon: ReactNode; label: string; value: number | string; sub?: string; href?: string; tag?: string; tone?: "warn" }) {
  const body = (
    <div className={`h-full rounded-lg border bg-white p-5 shadow-sm transition-colors ${tone === "warn" ? "border-amber-300" : "border-slate-200"} ${href ? "hover:border-slate-300" : ""}`}>
      <div className="flex items-center justify-between text-slate-500">
        <span className="flex items-center gap-2 text-xs font-medium">{icon}{label}</span>
        {tag && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{tag}</span>}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function Row({ label, value, href, warn }: { label: string; value: number | string; href?: string; warn?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4">
      {href ? <Link href={href} className="text-slate-600 hover:underline">{label}</Link> : <span className="text-slate-600">{label}</span>}
      <span className={`font-medium tabular-nums ${warn ? "text-amber-700" : "text-slate-900"}`}>{value}</span>
    </li>
  );
}

function RankList({ items, empty, icon }: { items: { id: number; name: string; value: string }[]; empty: string; icon: "views" | "enquiries" }) {
  const Icon = icon === "views" ? Eye : MessageCircle;
  if (!items.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ol className="space-y-2 text-sm">
      {items.map((item, i) => (
        <li key={item.id} className="flex items-center gap-3">
          <span className="w-4 text-xs text-slate-400 tabular-nums">{i + 1}</span>
          <Link href={`/admin/products/${item.id}`} className="flex-1 truncate hover:underline">{item.name}</Link>
          <span className="flex items-center gap-1 text-xs text-slate-500 tabular-nums"><Icon className="h-3 w-3" aria-hidden /><span className="sr-only">{icon === "views" ? "views:" : "enquiries:"}</span>{item.value}</span>
        </li>
      ))}
    </ol>
  );
}
