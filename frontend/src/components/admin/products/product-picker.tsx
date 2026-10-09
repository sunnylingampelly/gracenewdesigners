"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails */
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { useState } from "react";
import { useAdminQuery, useDebounced } from "@/lib/admin/hooks";
import type { ProductListRow } from "./types";

/** Ordered product selection (related products, complete-the-look). */
export function ProductPicker({ value, onChange, excludeId, max = 12 }: { value: number[]; onChange: (ids: number[]) => void; excludeId?: number; max?: number }) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q);
  const search = useAdminQuery<{ data: ProductListRow[] }>(debounced.length >= 2 ? "/admin/products" : null, { q: debounced, per_page: 8 });
  // Resolve labels for already-selected ids.
  const selected = useAdminQuery<{ data: ProductListRow[] }>(value.length ? "/admin/products" : null, { ids: [...value].sort((a, b) => a - b).join(","), per_page: 100 });
  const byId = new Map((selected.data?.data ?? []).concat(search.data?.data ?? []).map((p) => [p.id, p]));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products by name or SKU" aria-label="Search products to add" className="h-10 w-full rounded-md border border-slate-300 pr-3 pl-9 text-sm" disabled={value.length >= max} />
        {debounced.length >= 2 && (
          <ul className="absolute inset-x-0 top-11 z-20 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
            {search.data?.data.filter((p) => p.id !== excludeId && !value.includes(p.id)).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { onChange([...value, p.id]); setQ(""); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100">
                  {p.thumb_url ? <img src={p.thumb_url} alt="" className="h-8 w-7 rounded object-cover" /> : <span className="h-8 w-7 rounded bg-slate-100" />}
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-slate-400">{p.sku}</span>
                </button>
              </li>
            ))}
            {search.data && !search.data.data.length && <li className="px-2 py-2 text-sm text-slate-500">No matches</li>}
          </ul>
        )}
      </div>
      {value.length > 0 && (
        <ol className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {value.map((id, i) => {
            const p = byId.get(id);
            return (
              <li key={id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="w-5 text-xs text-slate-400">{i + 1}</span>
                <span className="flex-1 truncate">{p?.name ?? `Product #${id}`}</span>
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700" aria-label={`Remove ${p?.name ?? id}`}><X className="h-3.5 w-3.5" /></button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
