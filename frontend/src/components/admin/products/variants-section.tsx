"use client";

import { Trash2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Input, Select, StatusBadge } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import type { OptionValue } from "./lookups";
import type { MediaRow, StockPolicy, VariantRow } from "./types";

const POLICIES: { value: StockPolicy; label: string }[] = [
  { value: "track", label: "Track stock" },
  { value: "made_to_order", label: "Made to order" },
  { value: "untracked", label: "Don’t track" },
];

const code = (label: string | undefined) => (label ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);

/**
 * Size × colour matrix. Each row is one real combination with its own SKU, stock and optional price,
 * so availability can never be implied for combinations that don't exist.
 */
export function VariantsSection({ value, onChange, sizes, colors, productSku, media, errors, isMadeToOrder }: {
  value: VariantRow[];
  onChange: (rows: VariantRow[]) => void;
  sizes: OptionValue[];
  colors: OptionValue[];
  productSku: string;
  media: MediaRow[];
  errors: (key: string) => string | undefined;
  isMadeToOrder: boolean;
}) {
  const [pickSizes, setPickSizes] = useState<number[]>(() => [...new Set(value.map((v) => v.size_value_id).filter((x): x is number => x !== null))]);
  const [pickColors, setPickColors] = useState<number[]>(() => [...new Set(value.map((v) => v.color_value_id).filter((x): x is number => x !== null))]);
  const [bulkStock, setBulkStock] = useState("");
  const sizeById = useMemo(() => new Map(sizes.map((s) => [s.id, s])), [sizes]);
  const colorById = useMemo(() => new Map(colors.map((c) => [c.id, c])), [colors]);
  const groups = useMemo(() => [...new Set(sizes.map((s) => s.size_group ?? "Sizes"))], [sizes]);

  const generate = () => {
    const sizeList: (number | null)[] = pickSizes.length ? pickSizes : [null];
    const colorList: (number | null)[] = pickColors.length ? pickColors : [null];
    const existing = new Map(value.map((v) => [`${v.size_value_id}|${v.color_value_id}`, v]));
    const rows: VariantRow[] = [];
    for (const c of colorList) {
      for (const s of sizeList) {
        const key = `${s}|${c}`;
        rows.push(existing.get(key) ?? {
          sku: [productSku || "SKU", s ? code(sizeById.get(s)?.label) : null, c ? code(colorById.get(c)?.label) : null].filter(Boolean).join("-"),
          size_value_id: s,
          color_value_id: c,
          price: "",
          compare_at_price: "",
          stock_quantity: 0,
          stock_policy: isMadeToOrder ? "made_to_order" : "track",
          low_stock_threshold: 2,
          media_asset_id: null,
          is_active: true,
        });
      }
    }
    onChange(rows);
  };

  const update = (index: number, patch: Partial<VariantRow>) => onChange(value.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const removed = value.filter((v) => (v.size_value_id !== null && !pickSizes.includes(v.size_value_id)) || (v.color_value_id !== null && !pickColors.includes(v.color_value_id))).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-800">Sizes</legend>
          {groups.map((group) => (
            <div key={group} className="mb-2">
              <p className="mb-1 text-[11px] font-medium tracking-wide text-slate-400 uppercase">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {sizes.filter((s) => (s.size_group ?? "Sizes") === group).map((s) => (
                  <button key={s.id} type="button" aria-pressed={pickSizes.includes(s.id)} onClick={() => setPickSizes((p) => toggle(p, s.id))} className={cn("rounded-md border px-2.5 py-1 text-xs", pickSizes.includes(s.id) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:border-slate-500")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500">“Custom Size” is offered via the made-to-measure switch, not as a variant.</p>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-800">Colours</legend>
          <div className="flex flex-wrap gap-1.5">
            {colors.map((c) => (
              <button key={c.id} type="button" aria-pressed={pickColors.includes(c.id)} onClick={() => setPickColors((p) => toggle(p, c.id))} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs", pickColors.includes(c.id) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:border-slate-500")}>
                <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: c.hex ?? "#ccc" }} aria-hidden />
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-md bg-slate-50 p-3">
        <Button variant="secondary" size="sm" onClick={generate}><Wand2 className="h-4 w-4" /> {value.length ? "Update combinations" : "Generate combinations"}</Button>
        <span className="text-xs text-slate-500">
          {(pickSizes.length || 1) * (pickColors.length || 1)} combination(s). Existing rows keep their SKU and stock.
          {removed > 0 && <span className="text-amber-700"> {removed} row(s) will be removed.</span>}
        </span>
        {value.length > 0 && (
          <span className="ml-auto flex items-center gap-2">
            <Input aria-label="Set stock for all rows" value={bulkStock} onChange={(e) => setBulkStock(e.target.value.replace(/\D/g, ""))} placeholder="Stock" className="h-8 w-20 text-xs" />
            <Button size="sm" variant="secondary" disabled={!bulkStock} onClick={() => onChange(value.map((v) => ({ ...v, stock_quantity: Number(bulkStock) })))}>Apply to all</Button>
          </span>
        )}
      </div>

      {errors("variants") && <p className="text-xs text-red-700" role="alert">{errors("variants")}</p>}

      {value.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No variants. Without variants the product is enquired as a single item (e.g. one-size accessories).</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Combination</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Price override</th>
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Policy</th>
                <th className="px-3 py-2 font-medium">Image</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {value.map((row, i) => {
                const size = row.size_value_id ? sizeById.get(row.size_value_id) : null;
                const color = row.color_value_id ? colorById.get(row.color_value_id) : null;
                const label = [size?.label, color?.label].filter(Boolean).join(" / ") || "Default";
                return (
                  <tr key={row.id ?? `${row.size_value_id}-${row.color_value_id}-${i}`} className={cn(!row.is_active && "bg-slate-50 text-slate-400")}>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        {color && <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: color.hex ?? "#ccc" }} aria-hidden />}
                        {label}
                      </span>
                      {row.availability && <span className="mt-1 block"><StatusBadge status={row.availability} /></span>}
                    </td>
                    <td className="px-3 py-2">
                      <Input aria-label={`SKU for ${label}`} value={row.sku} onChange={(e) => update(i, { sku: e.target.value.toUpperCase() })} className="h-8 w-44 font-mono text-xs" invalid={!!errors(`variants.${i}.sku`)} />
                      {errors(`variants.${i}.sku`) && <p className="mt-1 text-[11px] text-red-700">{errors(`variants.${i}.sku`)}</p>}
                      {errors(`variants.${i}.size_value_id`) && <p className="mt-1 text-[11px] text-red-700">{errors(`variants.${i}.size_value_id`)}</p>}
                    </td>
                    <td className="px-3 py-2"><Input aria-label={`Price override for ${label}`} inputMode="decimal" value={row.price} onChange={(e) => update(i, { price: e.target.value.replace(/[^\d.]/g, "") })} placeholder="—" className="h-8 w-28 text-xs" /></td>
                    <td className="px-3 py-2">
                      <Input aria-label={`Stock for ${label}`} inputMode="numeric" value={String(row.stock_quantity)} disabled={row.stock_policy !== "track"} onChange={(e) => update(i, { stock_quantity: Number(e.target.value.replace(/\D/g, "") || 0) })} className="h-8 w-20 text-xs" />
                      {row.stock_policy === "track" && row.stock_quantity === 0 && <Badge tone="red" className="mt-1">Out of stock</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      <Select aria-label={`Stock policy for ${label}`} value={row.stock_policy} onChange={(e) => update(i, { stock_policy: e.target.value as StockPolicy })} className="h-8 w-36 text-xs">
                        {POLICIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Select aria-label={`Image for ${label}`} value={row.media_asset_id ?? ""} onChange={(e) => update(i, { media_asset_id: e.target.value ? Number(e.target.value) : null })} className="h-8 w-32 text-xs">
                        <option value="">Default</option>
                        {media.filter((m) => m.kind !== "video").map((m, j) => <option key={m.media_asset_id} value={m.media_asset_id}>Image {j + 1}</option>)}
                      </Select>
                    </td>
                    <td className="px-3 py-2"><input type="checkbox" aria-label={`Active: ${label}`} checked={row.is_active} onChange={(e) => update(i, { is_active: e.target.checked })} className="h-4 w-4 accent-slate-900" /></td>
                    <td className="px-3 py-2"><button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${label}`} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
