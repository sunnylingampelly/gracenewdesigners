"use client";

import { Field, Input, Switch } from "@/components/admin/ui";
import { formatMoney } from "@/lib/utils";

export type ShippingState = {
  requires_shipping: boolean;
  shipping_name: string;
  shipping_phone: string;
  shipping_line1: string;
  shipping_line2: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_country: string;
};

export const EMPTY_SHIPPING: ShippingState = { requires_shipping: true, shipping_name: "", shipping_phone: "", shipping_line1: "", shipping_line2: "", shipping_city: "", shipping_state: "", shipping_postal_code: "", shipping_country: "India" };

export function shippingPayload(s: ShippingState) {
  const out: Record<string, unknown> = { requires_shipping: s.requires_shipping };
  for (const [k, v] of Object.entries(s)) if (k !== "requires_shipping") out[k] = typeof v === "string" ? v.trim() || null : v;
  return out;
}

const FIELDS: { key: Exclude<keyof ShippingState, "requires_shipping">; label: string; max: number; wide?: boolean; type?: string; autoComplete?: string }[] = [
  { key: "shipping_name", label: "Recipient name", max: 150, autoComplete: "off" },
  { key: "shipping_phone", label: "Recipient phone", max: 32, type: "tel" },
  { key: "shipping_line1", label: "Address line 1", max: 255, wide: true },
  { key: "shipping_line2", label: "Address line 2", max: 255, wide: true },
  { key: "shipping_city", label: "City", max: 120 },
  { key: "shipping_state", label: "State", max: 120 },
  { key: "shipping_postal_code", label: "PIN / postal code", max: 20 },
  { key: "shipping_country", label: "Country", max: 80 },
];

export function ShippingFields({ value, onChange, fieldError, idPrefix }: { value: ShippingState; onChange: (v: ShippingState) => void; fieldError: (name: string) => string | undefined; idPrefix: string }) {
  return (
    <div className="space-y-4">
      <Switch checked={value.requires_shipping} onCheckedChange={(v) => onChange({ ...value, requires_shipping: v })} label="Requires shipping" description="Turn off for in-store collection or fittings." />
      {value.requires_shipping && (
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`${idPrefix}-${f.key}`} error={fieldError(f.key)} className={f.wide ? "sm:col-span-2" : undefined}>
              <Input id={`${idPrefix}-${f.key}`} type={f.type ?? "text"} value={value[f.key]} maxLength={f.max} onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} invalid={!!fieldError(f.key)} />
            </Field>
          ))}
        </div>
      )}
    </div>
  );
}

export function TotalsSummary({ subtotal, discount, shipping, tax, paid, currency = "INR" }: { subtotal: number; discount: number; shipping: number; tax: number; paid: number; currency?: string }) {
  const total = Math.max(0, subtotal - discount + shipping + tax);
  const balance = Math.max(0, total - paid);
  const row = (label: string, value: string, strong?: boolean) => (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-slate-200 pt-2 font-semibold text-slate-900" : "text-slate-600"}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
  return (
    <dl className="space-y-2 text-sm" aria-live="polite">
      {row("Subtotal", formatMoney(subtotal, currency))}
      {discount > 0 && row("Discount", `− ${formatMoney(discount, currency)}`)}
      {shipping > 0 && row("Shipping", formatMoney(shipping, currency))}
      {tax > 0 && row("Tax", formatMoney(tax, currency))}
      {row("Total", formatMoney(total, currency), true)}
      {row("Amount paid", formatMoney(paid, currency))}
      <div className={`flex justify-between gap-4 font-medium ${balance > 0 ? "text-amber-800" : "text-emerald-700"}`}>
        <dt>Balance due</dt>
        <dd className="tabular-nums">{formatMoney(balance, currency)}</dd>
      </div>
    </dl>
  );
}

export function MoneyInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return <Input id={id} type="number" min={0} step="0.01" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} invalid={invalid} placeholder="0.00" />;
}
