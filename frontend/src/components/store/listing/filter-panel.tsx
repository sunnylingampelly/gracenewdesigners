"use client";

import * as Accordion from "@radix-ui/react-accordion";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Facets, FacetValue } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { SORT_OPTIONS } from "@/lib/listing";

type Group = { key: string; title: string; values: FacetValue[]; swatch?: boolean };

function useListingParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const values = (key: string) => (searchParams.get(key) ?? "").split(",").filter(Boolean);

  const toggle = (key: string, value: string) =>
    apply((params) => {
      const current = new Set((params.get(key) ?? "").split(",").filter(Boolean));
      if (current.has(value)) current.delete(value);
      else current.add(value);
      if (current.size) params.set(key, [...current].join(","));
      else params.delete(key);
    });

  const set = (key: string, value: string | null) => setMany({ [key]: value });

  const setMany = (entries: Record<string, string | null>) =>
    apply((params) => {
      for (const [key, value] of Object.entries(entries)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
    });

  const clearAll = () =>
    apply((params) => {
      for (const key of [...params.keys()]) if (key !== "q" && key !== "sort") params.delete(key);
    });

  return { searchParams, pending, values, toggle, set, setMany, clearAll };
}

function groupsFrom(facets: Facets): Group[] {
  const groups: Group[] = [];
  if (facets.subcategories.length) groups.push({ key: "subcategory", title: "Category", values: facets.subcategories });
  if (facets.sizes.length) groups.push({ key: "size", title: "Size", values: facets.sizes });
  if (facets.colors.length) groups.push({ key: "color", title: "Colour", values: facets.colors, swatch: true });
  for (const attribute of facets.attributes) groups.push({ key: `attr[${attribute.code}]`, title: attribute.name, values: attribute.values });
  if (facets.occasions.length) groups.push({ key: "occasions", title: "Occasion", values: facets.occasions });
  if (facets.collections.length) groups.push({ key: "collections", title: "Collection", values: facets.collections });
  return groups;
}

export function FilterControls({ facets, hide = [] }: { facets: Facets; hide?: string[] }) {
  const { values, toggle, set, setMany, searchParams } = useListingParams();
  const groups = groupsFrom(facets).filter((g) => !hide.includes(g.key));
  const defaults = groups.slice(0, 3).map((g) => g.key);

  return (
    <Accordion.Root type="multiple" defaultValue={[...defaults, "price", "availability"]} className="divide-y divide-line border-y border-line">
      {groups.map((group) => (
        <Accordion.Item key={group.key} value={group.key}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex min-h-12 w-full items-center justify-between py-3 text-left text-[0.72rem] font-semibold tracking-[0.18em] uppercase">
              {group.title}
              {values(group.key).length > 0 && <span className="ml-2 text-royal">({values(group.key).length})</span>}
              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.4} />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pb-5">
            <ul className={cn(group.key === "size" ? "flex flex-wrap gap-2" : "space-y-1")}>
              {group.values.map((v) => {
                const selected = values(group.key).includes(v.value);
                if (group.key === "size") {
                  return (
                    <li key={v.value}>
                      <button type="button" aria-pressed={selected} onClick={() => toggle(group.key, v.value)} className={cn("min-h-10 min-w-12 border px-3 text-sm transition-colors", selected ? "border-midnight bg-midnight text-ivory" : "border-line-strong hover:border-ink")}>
                        {v.label}
                      </button>
                    </li>
                  );
                }
                return (
                  <li key={v.value}>
                    <button type="button" role="checkbox" aria-checked={selected} onClick={() => toggle(group.key, v.value)} className="flex min-h-10 w-full items-center gap-3 text-left text-sm">
                      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center border", selected ? "border-midnight bg-midnight text-ivory" : "border-line-strong")}>
                        {selected && <Check className="h-3 w-3" strokeWidth={2} />}
                      </span>
                      {group.swatch && <span aria-hidden className="h-3.5 w-3.5 rounded-full border border-ink/15" style={{ background: v.hex ?? "#ddd" }} />}
                      <span className="flex-1">{v.label}</span>
                      <span className="text-xs text-muted">{v.count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Accordion.Content>
        </Accordion.Item>
      ))}

      {facets.price.min !== null && facets.price.max !== null && facets.price.max > facets.price.min && (
        <Accordion.Item value="price">
          <Accordion.Header>
            <Accordion.Trigger className="group flex min-h-12 w-full items-center justify-between py-3 text-[0.72rem] font-semibold tracking-[0.18em] uppercase">
              Price <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.4} />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pb-5">
            <PriceRange min={facets.price.min} max={facets.price.max} currentMin={searchParams.get("price_min")} currentMax={searchParams.get("price_max")} onApply={(lo, hi) => setMany({ price_min: lo, price_max: hi })} />
            <p className="mt-2 text-xs text-muted">Designs priced on request are not included in price filters.</p>
          </Accordion.Content>
        </Accordion.Item>
      )}

      <Accordion.Item value="availability">
        <Accordion.Header>
          <Accordion.Trigger className="group flex min-h-12 w-full items-center justify-between py-3 text-[0.72rem] font-semibold tracking-[0.18em] uppercase">
            Availability <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.4} />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="space-y-1 pb-5">
          {[
            { key: "availability", value: "available", label: "Available to enquire" },
            { key: "fulfilment", value: "ready_to_ship", label: "Ready to ship" },
            { key: "fulfilment", value: "made_to_order", label: "Made to order" },
            { key: "custom_size", value: "1", label: "Custom sizing available" },
          ].map((option) => {
            const selected = searchParams.get(option.key) === option.value;
            return (
              <button key={option.label} type="button" role="checkbox" aria-checked={selected} onClick={() => set(option.key, selected ? null : option.value)} className="flex min-h-10 w-full items-center gap-3 text-left text-sm">
                <span className={cn("flex h-4 w-4 items-center justify-center border", selected ? "border-midnight bg-midnight text-ivory" : "border-line-strong")}>{selected && <Check className="h-3 w-3" strokeWidth={2} />}</span>
                {option.label}
              </button>
            );
          })}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function PriceRange({ min, max, currentMin, currentMax, onApply }: { min: number; max: number; currentMin: string | null; currentMax: string | null; onApply: (lo: string | null, hi: string | null) => void }) {
  const [lo, setLo] = useState(currentMin ?? "");
  const [hi, setHi] = useState(currentMax ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(lo || null, hi || null);
      }}
    >
      <div className="flex items-center gap-2">
        <label className="flex-1">
          <span className="sr-only">Minimum price</span>
          <input inputMode="numeric" value={lo} onChange={(e) => setLo(e.target.value.replace(/\D/g, ""))} placeholder={formatMoney(min)} className="h-10 w-full border border-line-strong bg-transparent px-3 text-sm" />
        </label>
        <span className="text-muted">–</span>
        <label className="flex-1">
          <span className="sr-only">Maximum price</span>
          <input inputMode="numeric" value={hi} onChange={(e) => setHi(e.target.value.replace(/\D/g, ""))} placeholder={formatMoney(max)} className="h-10 w-full border border-line-strong bg-transparent px-3 text-sm" />
        </label>
      </div>
      <button type="submit" className="text-[0.7rem] font-semibold tracking-[0.18em] text-royal uppercase">Apply price</button>
    </form>
  );
}

export function ListingToolbar({ total, facets, activeCount, hide }: { total: number; facets: Facets; activeCount: number; hide?: string[] }) {
  const { searchParams, set, clearAll, pending } = useListingParams();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-4">
      <div className="flex items-center gap-4">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className="inline-flex min-h-11 items-center gap-2 text-[0.72rem] font-semibold tracking-[0.18em] uppercase lg:hidden">
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.4} /> Filter {activeCount > 0 && `(${activeCount})`}
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-midnight/40" />
            <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[90vw] max-w-sm flex-col bg-ivory">
              <div className="flex h-16 items-center justify-between border-b border-line px-5">
                <Dialog.Title className="eyebrow">Filter</Dialog.Title>
                <Dialog.Description className="sr-only">Refine the designs shown</Dialog.Description>
                <Dialog.Close aria-label="Close filters" className="-mr-2 inline-flex h-11 w-11 items-center justify-center"><X className="h-5 w-5" strokeWidth={1.4} /></Dialog.Close>
              </div>
              <div className="flex-1 overflow-y-auto px-5">
                <FilterControls facets={facets} hide={hide} />
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-line p-5">
                <button type="button" onClick={clearAll} className="min-h-12 border border-ink/30 text-[0.7rem] font-semibold tracking-[0.18em] uppercase">Clear all</button>
                <Dialog.Close className="min-h-12 bg-midnight text-[0.7rem] font-semibold tracking-[0.18em] text-ivory uppercase">Show {total} {total === 1 ? "design" : "designs"}</Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <p className="text-sm text-muted" aria-live="polite">
          {pending ? "Updating…" : `${total} ${total === 1 ? "design" : "designs"}`}
        </p>
        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="hidden text-[0.7rem] font-semibold tracking-[0.16em] text-royal uppercase lg:inline">
            Clear all filters
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <span className="hidden text-muted sm:inline">Sort by</span>
        <span className="relative">
          <select
            value={searchParams.get("sort") ?? ""}
            onChange={(e) => set("sort", e.target.value || null)}
            className="h-11 appearance-none border-0 bg-transparent pr-7 pl-1 text-sm font-medium focus:outline-none"
            aria-label="Sort designs"
          >
            <option value="">Recommended</option>
            {SORT_OPTIONS.filter((o) => o.value !== "recommended").map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-0 h-4 w-4 -translate-y-1/2" strokeWidth={1.4} />
        </span>
      </label>
    </div>
  );
}

export function ActiveFilterChips({ facets }: { facets: Facets }) {
  const { searchParams, toggle, setMany } = useListingParams();
  const chips: { key: string; value: string; label: string }[] = [];
  for (const group of groupsFrom(facets)) {
    for (const value of (searchParams.get(group.key) ?? "").split(",").filter(Boolean)) {
      chips.push({ key: group.key, value, label: group.values.find((v) => v.value === value)?.label ?? value });
    }
  }
  const min = searchParams.get("price_min");
  const max = searchParams.get("price_max");
  if (!chips.length && !min && !max) return null;

  return (
    <ul className="flex flex-wrap gap-2 py-4" aria-label="Active filters">
      {chips.map((chip) => (
        <li key={chip.key + chip.value}>
          <button type="button" onClick={() => toggle(chip.key, chip.value)} className="inline-flex min-h-9 items-center gap-2 border border-line-strong bg-paper px-3 text-xs">
            {chip.label} <X className="h-3 w-3" aria-label="Remove" />
          </button>
        </li>
      ))}
      {(min || max) && (
        <li>
          <button type="button" onClick={() => setMany({ price_min: null, price_max: null })} className="inline-flex min-h-9 items-center gap-2 border border-line-strong bg-paper px-3 text-xs">
            {min ? formatMoney(Number(min)) : "Any"} – {max ? formatMoney(Number(max)) : "Any"} <X className="h-3 w-3" aria-label="Remove" />
          </button>
        </li>
      )}
    </ul>
  );
}
