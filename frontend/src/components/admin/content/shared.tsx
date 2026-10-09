"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails come straight from backend renditions */
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Plus, Search, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { MediaField, type AdminMedia } from "@/components/admin/media-picker";
import { Select } from "@/components/admin/ui";
import { useAdminQuery, useDebounced, type ListResponse } from "@/lib/admin/hooks";
import { cn } from "@/lib/utils";

// ---- Dates -----------------------------------------------------------------------------------------

/** ISO string -> value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> ISO string (or null when empty). */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Stable JSON for dirty checks. */
export function snapshot(value: unknown): string {
  return JSON.stringify(value);
}

let uidCounter = 0;
export function uid(prefix = "k"): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}`;
}

/** Open a preview URL in a new tab; the tab is opened synchronously so popup blockers allow it. */
export async function openPreview(getToken: () => Promise<string>, path: string): Promise<void> {
  const win = window.open("about:blank", "_blank");
  try {
    const token = await getToken();
    const url = `/api/preview?token=${encodeURIComponent(token)}&path=${encodeURIComponent(path)}`;
    if (win) win.location.href = url;
    else window.open(url, "_blank");
  } catch (error) {
    win?.close();
    throw error;
  }
}

// ---- Lookups ---------------------------------------------------------------------------------------

export type LookupKind = "categories" | "collections" | "occasions" | "lookbooks" | "departments" | "pages";
export type LookupOption = { value: number; label: string; depth?: number; hint?: string };

type Raw = { id: number; name?: string; title?: string; path?: string; depth?: number; is_published?: boolean; is_active?: boolean; status?: string };

export const LOOKUP_LABELS: Record<LookupKind, string> = {
  categories: "category",
  collections: "collection",
  occasions: "occasion",
  lookbooks: "lookbook",
  departments: "department",
  pages: "page",
};

/** Fetches a taxonomy/content list and maps it to select options. */
export function useLookup(kind: LookupKind, enabled = true) {
  const query = useAdminQuery<{ data: Raw[] }>(enabled ? `/admin/${kind}` : null);
  const options: LookupOption[] = (query.data?.data ?? []).map((r) => {
    const unpublished = r.is_published === false || r.is_active === false || (r.status !== undefined && r.status !== "published");
    return {
      value: r.id,
      label: r.name ?? r.title ?? `#${r.id}`,
      depth: kind === "categories" ? (r.depth ?? 0) : undefined,
      hint: [kind === "categories" ? r.path : null, unpublished ? "not live" : null].filter(Boolean).join(" · ") || undefined,
    };
  });
  return { options, isLoading: query.isLoading, error: query.error };
}

/** Select bound to a lookup list (nullable numeric id). */
export function LookupSelect({ kind, value, onChange, id, invalid, placeholder, required }: { kind: LookupKind; value: number | null | undefined; onChange: (v: number | null) => void; id?: string; invalid?: boolean; placeholder?: string; required?: boolean }) {
  const { options, isLoading, error } = useLookup(kind);
  if (error) {
    return <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Couldn’t load {kind}. {error instanceof Error ? error.message : ""}</p>;
  }
  return (
    <Select id={id} value={value ?? ""} invalid={invalid} required={required} disabled={isLoading} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{isLoading ? "Loading…" : (placeholder ?? `— Choose a ${LOOKUP_LABELS[kind]} —`)}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {"  ".repeat(o.depth ?? 0)}
          {o.label}
          {o.hint ? ` (${o.hint})` : ""}
        </option>
      ))}
      {value && !isLoading && !options.some((o) => o.value === value) ? <option value={value}>#{value} (missing)</option> : null}
    </Select>
  );
}

// ---- Media -----------------------------------------------------------------------------------------

/** MediaField that resolves a thumbnail for an existing media id. */
export function MediaIdField({ value, onChange, preview, kind = "image", label }: { value: number | null | undefined; onChange: (id: number | null) => void; preview?: string | null; kind?: AdminMedia["kind"]; label?: string }) {
  const [known, setKnown] = useState<Record<number, string | null>>({});
  const knownUrl = value ? known[value] : undefined;
  const needsFetch = !!value && knownUrl === undefined && !preview;
  const { data } = useAdminQuery<{ data: AdminMedia }>(needsFetch ? `/admin/media/${value}` : null);
  const fetched = data?.data ? (data.data.thumb_url ?? (data.data.kind === "image" ? data.data.url : null)) : null;
  const url = knownUrl ?? preview ?? fetched ?? null;
  return (
    <MediaField
      key={`${value ?? "none"}-${url ?? ""}`}
      value={value}
      preview={url}
      kind={kind}
      label={label ?? (kind === "video" ? "Choose video" : "Choose image")}
      onChange={(id, media) => {
        if (id && media) setKnown((k) => ({ ...k, [id]: media.thumb_url ?? (media.kind === "image" ? media.url : null) }));
        onChange(id);
      }}
    />
  );
}

// ---- Products --------------------------------------------------------------------------------------

type ProductRow = { id: number; name: string; sku: string | null; status: string; thumb_url: string | null };

/** Product name resolved by id (cached per id). */
export function ProductLabel({ id }: { id: number }) {
  const { data, error } = useAdminQuery<{ data: { id: number; name: string; sku: string | null } }>(`/admin/products/${id}`);
  if (error) return <span className="text-slate-500">Product #{id}</span>;
  if (!data) return <span className="text-slate-400">Loading…</span>;
  return (
    <span>
      {data.data.name}
      {data.data.sku && <span className="ml-1.5 text-xs text-slate-400">{data.data.sku}</span>}
    </span>
  );
}

/** Search box returning products from GET /admin/products. */
export function ProductSearch({ onPick, exclude = [], autoFocus }: { onPick: (p: ProductRow) => void; exclude?: number[]; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q.trim());
  const { data, isFetching, error } = useAdminQuery<ListResponse<ProductRow>>(debounced ? "/admin/products" : null, { q: debounced, per_page: 10 }, { keepPrevious: true });
  const results = debounced ? (data?.data ?? []).filter((p) => !exclude.includes(p.id)) : [];
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" aria-hidden />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products by name or SKU"
        aria-label="Search products"
        autoFocus={autoFocus}
        className="h-9 w-full rounded-md border border-slate-300 pr-3 pl-9 text-sm shadow-sm focus:border-royal focus:ring-2 focus:ring-royal/20 focus:outline-none"
      />
      {debounced && (
        <ul className="mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm" aria-live="polite">
          {error ? (
            <li className="px-3 py-2 text-xs text-red-700">{error instanceof Error ? error.message : "Search failed"}</li>
          ) : isFetching && !data ? (
            <li className="px-3 py-2 text-xs text-slate-500">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">No matching products</li>
          ) : (
            results.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { onPick(p); setQ(""); }} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none">
                  {p.thumb_url ? <img src={p.thumb_url} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="h-8 w-8 rounded bg-slate-100" />}
                  <span className="flex-1">
                    {p.name}
                    <span className="block text-xs text-slate-400">{p.sku} · {p.status}</span>
                  </span>
                  <Plus className="h-4 w-4 text-slate-400" aria-hidden />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** Ordered multi-product picker storing ids. */
export function ProductListPicker({ value, onChange, max = 24 }: { value: number[]; onChange: (ids: number[]) => void; max?: number }) {
  const move = (i: number, dir: -1 | 1) => onChange(arrayMove(value, i, i + dir));
  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ol className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {value.map((id, i) => (
            <li key={id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="w-5 text-xs text-slate-400 tabular-nums">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate"><ProductLabel id={id} /></span>
              <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
              <IconButton label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
              <IconButton label="Remove product" onClick={() => onChange(value.filter((x) => x !== id))}><X className="h-3.5 w-3.5" /></IconButton>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-slate-500">No products selected yet.</p>
      )}
      {value.length < max ? <ProductSearch exclude={value} onPick={(p) => onChange([...value, p.id])} /> : <p className="text-xs text-slate-500">Maximum of {max} products reached.</p>}
    </div>
  );
}

// ---- Small controls --------------------------------------------------------------------------------

export function IconButton({ label, onClick, disabled, children, className }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={cn("inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-royal disabled:pointer-events-none disabled:opacity-30", className)}>
      {children}
    </button>
  );
}

/** Segmented single-choice control (radio group). */
export function ChoiceGroup<T extends string>({ value, onChange, options, label, allowEmpty }: { value: T | null | undefined; onChange: (v: T | null) => void; options: { value: T; label: string }[]; label: string; allowEmpty?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-md border border-slate-300 bg-white p-0.5 shadow-sm">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active && allowEmpty ? null : o.value)}
            className={cn("rounded px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-royal", active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Sortable --------------------------------------------------------------------------------------

export type DragHandleProps = { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined; setActivator: (el: HTMLElement | null) => void };

export function DragHandle({ handle, label }: { handle: DragHandleProps; label: string }) {
  const { attributes, listeners, setActivator } = handle;
  return (
    <button
      type="button"
      ref={setActivator}
      {...attributes}
      {...listeners}
      aria-label={label}
      className="inline-flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-royal active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function SortableItem({ id, children, className }: { id: string | number; children: (handle: DragHandleProps, dragging: boolean) => ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(className, isDragging && "relative z-10 opacity-80 shadow-lg")}>
      {children({ attributes: attributes as unknown as Record<string, unknown>, listeners: listeners as Record<string, unknown> | undefined, setActivator: setActivatorNodeRef }, isDragging)}
    </li>
  );
}

/**
 * Drag-and-drop sortable list (pointer + keyboard: focus a handle, Space to lift, arrows to move, Space to drop).
 */
export function SortableList<T>({ items, getId, onReorder, children, className, itemClassName, grid, label = "item" }: { items: T[]; getId: (item: T) => string | number; onReorder: (items: T[]) => void; children: (item: T, handle: DragHandleProps, index: number, dragging: boolean) => ReactNode; className?: string; itemClassName?: string; grid?: boolean; label?: string }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = items.map(getId);
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(e.active.id);
    const to = ids.indexOf(e.over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };
  const position = (id: string | number) => ids.indexOf(id) + 1;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${label} ${position(active.id)} of ${ids.length}.`,
          onDragOver: ({ active, over }) => (over ? `${label} ${position(active.id)} is over position ${position(over.id)}.` : `${label} is no longer over a drop position.`),
          onDragEnd: ({ over }) => (over ? `${label} dropped at position ${position(over.id)}.` : `${label} dropped.`),
          onDragCancel: () => "Sorting cancelled.",
        },
        screenReaderInstructions: { draggable: "To reorder, press Space or Enter on the handle, use the arrow keys to move, then press Space or Enter again to drop. Press Escape to cancel." },
      }}
    >
      <SortableContext items={ids} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item, index) => (
            <SortableItem key={getId(item)} id={getId(item)} className={itemClassName}>
              {(handle, dragging) => children(item, handle, index, dragging)}
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// ---- Errors ----------------------------------------------------------------------------------------

/** Read a 422 error for a config field: Laravel may key it "config.x" or just "x". */
export function makeErrorReader(errors: Record<string, string[]>, prefix?: string) {
  return (name: string): string | undefined => (prefix ? errors[`${prefix}.${name}`]?.[0] : undefined) ?? errors[name]?.[0];
}

// ---- Pages -----------------------------------------------------------------------------------------

export const PAGE_TEMPLATES = [
  { value: "default", label: "Default" },
  { value: "story", label: "Story (editorial)" },
  { value: "policy", label: "Policy" },
  { value: "contact", label: "Contact" },
] as const;

const ALLOWED_TAGS = new Set(["H2", "H3", "H4", "P", "BR", "STRONG", "B", "EM", "I", "U", "BLOCKQUOTE", "UL", "OL", "LI", "A", "HR"]);
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "SVG", "MATH", "FORM", "INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

/** Client-side preview sanitizer mirroring the backend allowlist (the server remains authoritative). */
export function sanitizePreviewHtml(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const walk = (parent: Node) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.COMMENT_NODE) {
        node.remove();
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      if (DROP_TAGS.has(el.tagName)) {
        el.remove();
        continue;
      }
      walk(el);
      if (!ALLOWED_TAGS.has(el.tagName)) {
        el.replaceWith(...Array.from(el.childNodes));
        continue;
      }
      for (const attr of Array.from(el.attributes)) {
        const keep = el.tagName === "A" && attr.name === "href" && /^(\/|https?:\/\/|mailto:|tel:|#)/i.test(attr.value.trim());
        if (!keep) el.removeAttribute(attr.name);
      }
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
