"use client";

/**
 * Shared types, lookups and small building blocks for the sales admin screens
 * (enquiries, orders, customers).
 */
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, Input } from "@/components/admin/ui";
import { useAdminQuery } from "@/lib/admin/hooks";
import { formatDateTime } from "@/lib/utils";

// ---- Types ---------------------------------------------------------------------------------------

export type Option = { value: string; label: string };
export type Assignee = { id: number; name: string };
export type Contact = { name?: string; phone?: string; email?: string };

export type EnquiryRow = {
  id: number;
  reference: string;
  type: string;
  status: string;
  status_label: string;
  created_at: string;
  redirect_initiated_at: string | null;
  product: string | null;
  variant: string | null;
  quantity: number;
  item_count: number;
  display_total: string | null;
  lead_source: string | null;
  source_path: string | null;
  /** PHP's array_filter can serialise an empty contact as []. */
  contact: Contact | [] | null;
  assigned_to: Assignee | null;
  follow_up_at: string | null;
  is_overdue: boolean | null;
};

export type EnquiryItem = {
  id: number;
  product_id: number | null;
  product_variant_id: number | null;
  product_name: string;
  product_sku: string | null;
  variant_sku: string | null;
  size_label: string | null;
  color_label: string | null;
  is_custom_size: boolean;
  quantity: number;
  currency: string;
  product_url: string | null;
  price_mode: string;
  unit_price: string | null;
  price_label: string | null;
  product_exists: boolean;
};

export type HistoryEntry = { field?: string; from: string | null; to: string | null; note: string | null; user: string | null; created_at: string | null };

export type EnquiryDetail = EnquiryRow & {
  customer_message: string | null;
  measurements: Record<string, unknown> | unknown[] | null;
  fitting_consultation_requested: boolean;
  preferred_date: string | null;
  attribution: Record<string, string> | [] | null;
  customer: { id: number; name: string | null; phone: string | null; email: string | null; city: string | null; country: string | null; marketing_consent: boolean } | null;
  whatsapp_message: string | null;
  items: EnquiryItem[];
  history: HistoryEntry[];
  notes: { id: number; body: string; user: string | null; created_at: string }[];
  order: { id: number; reference: string; status: string } | null;
};

export type OrderRow = {
  id: number;
  reference: string;
  enquiry_reference: string | null;
  customer: string | null;
  items: string;
  total: number;
  total_label: string;
  status: string;
  status_label: string;
  payment_status: string;
  payment_status_label: string;
  created_at: string;
  expected_delivery_date: string | null;
};

export type OrderItem = {
  id: number;
  product_id: number | null;
  product_variant_id: number | null;
  product_name: string;
  sku: string | null;
  size_label: string | null;
  color_label: string | null;
  is_custom_size: boolean;
  quantity: number;
  unit_price: string;
  line_total: string;
  notes: string | null;
};

export type OrderDetail = {
  id: number;
  reference: string;
  enquiry_id: number | null;
  customer_id: number | null;
  payment_note: string | null;
  currency: string;
  subtotal: string;
  discount_amount: string;
  shipping_amount: string;
  tax_amount: string;
  total: string;
  amount_paid: string;
  requires_shipping: boolean;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_line1: string | null;
  shipping_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  internal_notes: string | null;
  stock_committed: boolean;
  status: string;
  payment_status: string;
  balance_due: number;
  expected_delivery_date: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_by: string | null;
  created_at: string;
  enquiry: { id: number; reference: string } | null;
  customer: { id: number; name: string | null; phone: string | null; email: string | null; city: string | null; country: string | null } | null;
  items: OrderItem[];
  history: HistoryEntry[];
};

export type CustomerRow = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  marketing_consent: boolean;
  enquiries_count: number;
  orders_count: number;
  created_at: string;
};

// ---- Lookups -------------------------------------------------------------------------------------

export const ENQUIRY_TYPES: Option[] = [
  { value: "product", label: "Product" },
  { value: "bag", label: "Enquiry bag" },
  { value: "consultation", label: "Consultation" },
  { value: "contact", label: "Contact form" },
];

export function useStatusLookups() {
  const q = useAdminQuery<{ data: { order: Option[]; payment: Option[]; enquiry: Option[] } }>("/admin/lookups/statuses");
  return { ...q, lookups: q.data?.data };
}

export function useAssignees(enabled = true) {
  const q = useAdminQuery<{ data: Assignee[] }>(enabled ? "/admin/team/assignees" : null);
  return { ...q, assignees: q.data?.data ?? [] };
}

export function labelFor(options: Option[] | undefined, value: string | null | undefined): string {
  if (!value) return "—";
  return options?.find((o) => o.value === value)?.label ?? value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// ---- Helpers -------------------------------------------------------------------------------------

/** Normalises the contact object (PHP may send [] when nothing was supplied). */
export function contactOf(contact: EnquiryRow["contact"]): Contact | null {
  if (!contact || Array.isArray(contact)) return null;
  return contact.name || contact.phone || contact.email ? contact : null;
}

/** Digits-only phone for wa.me links; null when there is nothing usable. */
export function whatsappDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

/** ISO timestamp → value for <input type="datetime-local">, expressed in IST (operations timezone). */
export function isoToIstInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** datetime-local value (IST) → ISO string with explicit +05:30 offset. */
export function istInputToIso(value: string): string | null {
  return value ? `${value}:00+05:30` : null;
}

export function num(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function handoffLabel(redirectInitiatedAt: string | null): { text: string; tone: "green" | "slate" } {
  return redirectInitiatedAt ? { text: "WhatsApp handoff started", tone: "green" } : { text: "Saved (handoff not confirmed)", tone: "slate" };
}

export function HandoffBadge({ at }: { at: string | null }) {
  const h = handoffLabel(at);
  return <Badge tone={h.tone}>{h.text}</Badge>;
}

// ---- Timeline ------------------------------------------------------------------------------------

export function Timeline({ entries, empty }: { entries: { key: string | number; title: ReactNode; body?: ReactNode; meta: string }[]; empty: string }) {
  if (!entries.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {entries.map((e) => (
        <li key={e.key} className="relative">
          <span className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400" aria-hidden />
          <div className="text-sm text-slate-900">{e.title}</div>
          {e.body && <div className="mt-1 text-sm whitespace-pre-wrap text-slate-600">{e.body}</div>}
          <p className="mt-0.5 text-xs text-slate-400">{e.meta}</p>
        </li>
      ))}
    </ol>
  );
}

export function timelineMeta(user: string | null, at: string | null): string {
  return `${user ?? "System"} · ${formatDateTime(at)}`;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="text-royal hover:underline" onClick={(e) => e.stopPropagation()}>{children}</Link>;
}

/** Search box that keeps its own text and commits to the URL after a short pause. */
export function DebouncedSearch({ id, value, onCommit, placeholder, delay = 350 }: { id: string; value: string; onCommit: (v: string) => void; placeholder?: string; delay?: number }) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastExternal, setLastExternal] = useState(value);
  if (value !== lastExternal) {
    // URL changed elsewhere (e.g. "Clear filters" or back navigation): follow it.
    setLastExternal(value);
    setText(value);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <Input
      id={id}
      type="search"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onCommit(v.trim()), delay);
      }}
    />
  );
}
