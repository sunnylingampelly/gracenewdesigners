"use client";

import { Plus, Search, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import { Badge, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { useAdminQuery, useDebounced, type ListResponse } from "@/lib/admin/hooks";
import { formatMoney } from "@/lib/utils";
import { num } from "./shared";

export type ItemDraft = {
  key: string;
  product_id: number | null;
  product_variant_id: number | null;
  /** Name of the linked catalogue product (display only). */
  product_title: string | null;
  product_name: string;
  size_label: string;
  color_label: string;
  is_custom_size: boolean;
  quantity: string;
  unit_price: string;
  notes: string;
  /** Price the site displayed when the enquiry was saved — a hint only, never the agreed price. */
  displayed_price: string | null;
};

let keySeq = 0;
export function newItem(patch: Partial<ItemDraft> = {}): ItemDraft {
  keySeq += 1;
  return { key: `item-${Date.now()}-${keySeq}`, product_id: null, product_variant_id: null, product_title: null, product_name: "", size_label: "", color_label: "", is_custom_size: false, quantity: "1", unit_price: "", notes: "", displayed_price: null, ...patch };
}

export function itemsPayload(items: ItemDraft[]) {
  return items.map((i) => ({
    product_id: i.product_id,
    product_variant_id: i.product_variant_id,
    product_name: i.product_name.trim() || null,
    size_label: i.size_label.trim() || null,
    color_label: i.color_label.trim() || null,
    is_custom_size: i.is_custom_size,
    quantity: Number(i.quantity),
    unit_price: i.unit_price === "" ? null : Number(i.unit_price),
    notes: i.notes.trim() || null,
  }));
}

export function itemsSubtotal(items: ItemDraft[]): number {
  return items.reduce((sum, i) => sum + num(i.quantity) * num(i.unit_price), 0);
}

type ProductHit = { id: number; name: string; sku: string | null; price_label: string; thumb_url: string | null; status: string; variant_count: number };
type ProductFull = { id: number; name: string; currency: string; price: string | null; variants: { id: number; sku: string | null; size_value_id: number | null; color_value_id: number | null; price: string | null; stock_quantity: number; stock_policy: string; is_active: boolean; availability: string }[] };
type OptionDef = { id: number; code: string; values: { id: number; label: string }[] };

export function OrderItemsEditor({ items, onChange, fieldError, disabled }: { items: ItemDraft[]; onChange: (items: ItemDraft[]) => void; fieldError: (name: string) => string | undefined; disabled?: boolean }) {
  const update = (index: number, patch: Partial<ItemDraft>) => onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-4">
      {fieldError("items") && <p className="text-sm text-red-700" role="alert">{fieldError("items")}</p>}
      {items.map((item, index) => (
        <ItemRow
          key={item.key}
          index={index}
          item={item}
          disabled={disabled}
          fieldError={fieldError}
          onChange={(patch) => update(index, patch)}
          onRemove={items.length > 1 ? () => onChange(items.filter((_, i) => i !== index)) : undefined}
        />
      ))}
      {!disabled && (
        <Button variant="secondary" size="sm" onClick={() => onChange([...items, newItem()])} disabled={items.length >= 50}>
          <Plus className="h-4 w-4" aria-hidden /> Add item
        </Button>
      )}
    </div>
  );
}

function ItemRow({ index, item, onChange, onRemove, fieldError, disabled }: { index: number; item: ItemDraft; onChange: (patch: Partial<ItemDraft>) => void; onRemove?: () => void; fieldError: (name: string) => string | undefined; disabled?: boolean }) {
  const id = useId();
  const { can } = useAuth();
  const err = (f: string) => fieldError(`items.${index}.${f}`);
  const lineTotal = num(item.quantity) * num(item.unit_price);

  return (
    <fieldset className="rounded-lg border border-slate-200 p-4" disabled={disabled}>
      <legend className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Item {index + 1}</legend>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          {item.product_id ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="blue">Catalogue product</Badge>
              <span className="font-medium text-slate-900">{item.product_title ?? `Product #${item.product_id}`}</span>
              {!disabled && <Button variant="ghost" size="sm" onClick={() => onChange({ product_id: null, product_variant_id: null, product_title: null })}><X className="h-3.5 w-3.5" aria-hidden /> Unlink product</Button>}
            </div>
          ) : !disabled && can("products.view") ? (
            <ProductSearch onPick={(p) => onChange({ product_id: p.id, product_title: p.name, product_name: p.name, product_variant_id: null })} />
          ) : null}
          {item.product_id && can("products.view") && (
            <VariantChooser productId={item.product_id} value={item.product_variant_id} disabled={disabled} onPick={(v) => onChange({ product_variant_id: v?.id ?? null, ...(v ? { size_label: v.size ?? "", color_label: v.color ?? "" } : {}) })} />
          )}
        </div>

        <Field label={item.product_id ? "Item name on order" : "Item name (bespoke / free text)"} htmlFor={`${id}-name`} required={!item.product_id} error={err("product_name")} className="md:col-span-2">
          <Input id={`${id}-name`} value={item.product_name} onChange={(e) => onChange({ product_name: e.target.value })} maxLength={255} invalid={!!err("product_name")} placeholder={item.product_id ? "Defaults to the product name" : "e.g. Bespoke bridal lehenga"} />
        </Field>

        <Field label="Size" htmlFor={`${id}-size`} error={err("size_label")}>
          <Input id={`${id}-size`} value={item.size_label} onChange={(e) => onChange({ size_label: e.target.value })} maxLength={80} />
        </Field>
        <Field label="Colour" htmlFor={`${id}-color`} error={err("color_label")}>
          <Input id={`${id}-color`} value={item.color_label} onChange={(e) => onChange({ color_label: e.target.value })} maxLength={80} />
        </Field>
        <Checkbox className="md:col-span-2" label="Custom size" description="Made to the customer's measurements." checked={item.is_custom_size} onChange={(e) => onChange({ is_custom_size: e.target.checked })} />

        <Field label="Quantity" htmlFor={`${id}-qty`} required error={err("quantity")}>
          <Input id={`${id}-qty`} type="number" min={1} max={100} step={1} inputMode="numeric" value={item.quantity} onChange={(e) => onChange({ quantity: e.target.value })} invalid={!!err("quantity")} />
        </Field>
        <Field
          label="Agreed unit price (₹)"
          htmlFor={`${id}-price`}
          required
          error={err("unit_price")}
          hint={item.displayed_price !== null ? <>Site displayed {formatMoney(item.displayed_price)} — confirm the price agreed with the customer.</> : "Enter the price agreed with the customer."}
        >
          <Input id={`${id}-price`} type="number" min={0} step="0.01" inputMode="decimal" value={item.unit_price} onChange={(e) => onChange({ unit_price: e.target.value })} invalid={!!err("unit_price")} placeholder="0.00" />
        </Field>

        <Field label="Item notes" htmlFor={`${id}-notes`} error={err("notes")} className="md:col-span-2">
          <Textarea id={`${id}-notes`} rows={2} value={item.notes} onChange={(e) => onChange({ notes: e.target.value })} maxLength={1000} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
        <span className="text-slate-600">Line total: <span className="font-medium text-slate-900 tabular-nums">{formatMoney(lineTotal)}</span></span>
        {onRemove && !disabled && <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove item ${index + 1}`}><Trash2 className="h-4 w-4" aria-hidden /> Remove</Button>}
      </div>
    </fieldset>
  );
}

function ProductSearch({ onPick }: { onPick: (p: ProductHit) => void }) {
  const id = useId();
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 300);
  const { data, isFetching } = useAdminQuery<ListResponse<ProductHit>>(term.length >= 2 ? "/admin/products" : null, { q: term, per_page: 8 });
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-800">Link a catalogue product (optional)</label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" aria-hidden />
        <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU…" className="pl-9" autoComplete="off" />
      </div>
      {term.length >= 2 && (
        <ul className="mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm" aria-label="Product results">
          {isFetching && !data && <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>}
          {data?.data.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No products found. Use a free-text name for bespoke items.</li>}
          {data?.data.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { onPick(p); setQ(""); }} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none">
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny admin thumbnail from our own media renditions */}
                {p.thumb_url ? <img src={p.thumb_url} alt="" className="h-9 w-9 shrink-0 rounded object-cover" /> : <span className="h-9 w-9 shrink-0 rounded bg-slate-100" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{p.name}</span>
                  <span className="block text-xs text-slate-500">{p.sku ?? "No SKU"} · {p.variant_count} variant{p.variant_count === 1 ? "" : "s"} · {p.status}</span>
                </span>
                <span className="text-xs text-slate-600">{p.price_label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VariantChooser({ productId, value, onPick, disabled }: { productId: number; value: number | null; onPick: (v: { id: number; size: string | null; color: string | null } | null) => void; disabled?: boolean }) {
  const id = useId();
  const { data, isLoading, error } = useAdminQuery<{ data: ProductFull }>(`/admin/products/${productId}`);
  const { data: options, isLoading: optionsLoading } = useAdminQuery<{ data: OptionDef[] }>("/admin/options");
  const labelOf = (valueId: number | null) => {
    if (!valueId) return null;
    for (const o of options?.data ?? []) {
      const v = o.values.find((x) => x.id === valueId);
      if (v) return v.label;
    }
    return null;
  };

  if (isLoading || optionsLoading) return <p className="text-xs text-slate-500">Loading variants…</p>;
  if (error || !data) return <p className="text-xs text-slate-500">Variants could not be loaded; enter size and colour manually.</p>;
  const variants = data.data.variants ?? [];
  if (!variants.length) return <p className="text-xs text-slate-500">This product has no variants.</p>;

  return (
    <Field label="Variant (optional)" htmlFor={id} hint="Choosing a tracked variant means confirming the order will deduct its stock.">
      <Select
        id={id}
        value={value ? String(value) : ""}
        disabled={disabled}
        onChange={(e) => {
          const v = variants.find((x) => String(x.id) === e.target.value);
          onPick(v ? { id: v.id, size: labelOf(v.size_value_id), color: labelOf(v.color_value_id) } : null);
        }}
      >
        <option value="">No specific variant</option>
        {variants.map((v) => {
          const label = [labelOf(v.size_value_id), labelOf(v.color_value_id)].filter(Boolean).join(" / ") || "Default";
          const stock = v.stock_policy === "track" ? `${v.stock_quantity} in stock` : v.availability.replace(/_/g, " ");
          return <option key={v.id} value={String(v.id)}>{label} — {v.sku ?? "no SKU"} ({stock}){v.is_active ? "" : " · inactive"}</option>;
        })}
      </Select>
    </Field>
  );
}
