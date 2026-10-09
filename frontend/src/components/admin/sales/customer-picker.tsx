"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Button, Input } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { useAdminQuery, useDebounced, type ListResponse } from "@/lib/admin/hooks";
import type { CustomerRow } from "./shared";

export type PickedCustomer = { id: number; name: string | null; phone: string | null; email: string | null };

export function customerLabel(c: { id: number; name: string | null; phone?: string | null; email?: string | null }): string {
  return c.name || c.phone || c.email || `Customer #${c.id}`;
}

/** Optional customer link for an order, searchable by name / phone / email. */
export function CustomerPicker({ value, onChange, error }: { value: PickedCustomer | null; onChange: (c: PickedCustomer | null) => void; error?: string }) {
  const id = useId();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 300);
  const canSearch = can("customers.view");
  const { data, isFetching } = useAdminQuery<ListResponse<CustomerRow>>(canSearch && term.length >= 2 ? "/admin/customers" : null, { q: term, per_page: 8 });

  if (value) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <div>
          <p className="font-medium text-slate-900">{customerLabel(value)}</p>
          <p className="text-xs text-slate-500">{[value.phone, value.email].filter(Boolean).join(" · ") || "No contact details on record"}</p>
        </div>
        <div className="flex items-center gap-2">
          {canSearch && <Link href={`/admin/customers/${value.id}`} className="text-xs text-royal hover:underline" target="_blank">Open record</Link>}
          <Button variant="ghost" size="sm" onClick={() => onChange(null)} aria-label="Remove linked customer"><X className="h-3.5 w-3.5" aria-hidden /> Remove</Button>
        </div>
        {error && <p className="w-full text-xs text-red-700" role="alert">{error}</p>}
      </div>
    );
  }

  if (!canSearch) return <p className="text-sm text-slate-500">No customer linked. (Searching customers requires the customers permission.)</p>;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-800">Customer (optional)</label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" aria-hidden />
        <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone or email…" className="pl-9" autoComplete="off" invalid={!!error} />
      </div>
      {error && <p className="mt-1 text-xs text-red-700" role="alert">{error}</p>}
      {term.length >= 2 && (
        <ul className="mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm" aria-label="Customer results">
          {isFetching && !data && <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>}
          {data?.data.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No customers found.</li>}
          {data?.data.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { onChange({ id: c.id, name: c.name, phone: c.phone, email: c.email }); setQ(""); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none">
                <span className="font-medium text-slate-900">{customerLabel(c)}</span>
                <span className="block text-xs text-slate-500">{[c.phone, c.email, c.city].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
