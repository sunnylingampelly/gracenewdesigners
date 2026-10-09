"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CornerDownRight, IndentDecrease, IndentIncrease, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { IconButton, LookupSelect, MediaIdField, snapshot, uid, useLookup, type LookupKind } from "@/components/admin/content/shared";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorNotice, Field, Input, PageHeader, Select, Spinner, Tabs, useConfirm } from "@/components/admin/ui";
import { adminApi, useAdminMutation, useAdminQuery, useUnsavedChangesWarning } from "@/lib/admin/hooks";
import { cn } from "@/lib/utils";

type LinkType = "url" | "department" | "category" | "collection" | "occasion" | "page" | "lookbook" | "route";
type ApiItem = {
  id: number; label: string; link_type: LinkType; link_id: number | null; url: string | null; group_heading: string | null; image_media_id: number | null;
  highlight_text: string | null; open_in_new_tab: boolean; is_active: boolean; children: ApiItem[];
};
type Menu = { id: number; name: string; location: string; items: ApiItem[] };
type MenusResponse = { data: Menu[]; meta: { link_types: LinkType[]; routes: string[] } };

/** Flat row: the tree is edited as a depth-annotated list, which makes move/indent/outdent simple. */
type Row = { key: string; id?: number; depth: number; label: string; link_type: LinkType; link_id: number | null; url: string; group_heading: string; image_media_id: number | null; highlight_text: string; open_in_new_tab: boolean; is_active: boolean };
type OutItem = Omit<Row, "key" | "depth" | "url" | "group_heading" | "highlight_text"> & { url: string | null; group_heading: string | null; highlight_text: string | null; children: OutItem[] };

const MAX_DEPTH = 2; // three levels: 0, 1, 2

const LOCATION_LABELS: Record<string, string> = {
  header: "Header (main menu)",
  footer_shop: "Footer — Shop",
  footer_house: "Footer — The House",
  footer_help: "Footer — Help",
  mobile_secondary: "Mobile secondary",
};
const LINK_TYPE_LABELS: Record<LinkType, string> = {
  url: "Custom URL", department: "Department", category: "Category", collection: "Collection", occasion: "Occasion", page: "Page", lookbook: "Lookbook", route: "Storefront page",
};
const LOOKUP_FOR: Partial<Record<LinkType, LookupKind>> = { department: "departments", category: "categories", collection: "collections", occasion: "occasions", page: "pages", lookbook: "lookbooks" };
const ROUTE_LABELS: Record<string, string> = {
  home: "Home", shop: "Shop all", "new-arrivals": "New arrivals", collections: "All collections", occasions: "All occasions", lookbook: "Lookbook index",
  wishlist: "Wishlist", bag: "Bag", contact: "Contact", consultation: "Book a consultation", search: "Search",
};

function flatten(items: ApiItem[], depth = 0, out: Row[] = []): Row[] {
  for (const i of items) {
    out.push({
      key: `n${i.id}`, id: i.id, depth, label: i.label, link_type: i.link_type, link_id: i.link_id, url: i.url ?? "", group_heading: i.group_heading ?? "",
      image_media_id: i.image_media_id, highlight_text: i.highlight_text ?? "", open_in_new_tab: !!i.open_in_new_tab, is_active: i.is_active !== false,
    });
    flatten(i.children ?? [], depth + 1, out);
  }
  return out;
}

function build(rows: Row[]): OutItem[] {
  const root: OutItem[] = [];
  const stack: OutItem[][] = [root];
  for (const r of rows) {
    const item: OutItem = {
      ...(r.id ? { id: r.id } : {}), label: r.label, link_type: r.link_type,
      link_id: r.link_type === "url" || r.link_type === "route" ? null : r.link_id,
      url: r.link_type === "url" || r.link_type === "route" ? r.url.trim() || null : null,
      group_heading: r.group_heading.trim() || null, image_media_id: r.image_media_id, highlight_text: r.highlight_text.trim() || null,
      open_in_new_tab: r.open_in_new_tab, is_active: r.is_active, children: [],
    };
    stack.length = r.depth + 1;
    stack[r.depth].push(item);
    stack[r.depth + 1] = item.children;
  }
  return root;
}

/** API error path for every row, e.g. "items.0.children.2". */
function rowPaths(rows: Row[]): string[] {
  const counters: number[] = [];
  const prefixes: string[] = [];
  return rows.map((r) => {
    counters.length = r.depth + 1;
    counters[r.depth] = (counters[r.depth] ?? -1) + 1;
    const path = r.depth === 0 ? `items.${counters[0]}` : `${prefixes[r.depth - 1]}.children.${counters[r.depth]}`;
    prefixes[r.depth] = path;
    prefixes.length = r.depth + 1;
    return path;
  });
}

const blockEnd = (rows: Row[], i: number) => {
  let j = i + 1;
  while (j < rows.length && rows[j].depth > rows[i].depth) j += 1;
  return j;
};
const subtreeHeight = (rows: Row[], i: number) => rows.slice(i, blockEnd(rows, i)).reduce((m, r) => Math.max(m, r.depth - rows[i].depth), 0);
const prevSibling = (rows: Row[], i: number) => {
  for (let j = i - 1; j >= 0; j -= 1) {
    if (rows[j].depth === rows[i].depth) return j;
    if (rows[j].depth < rows[i].depth) return -1;
  }
  return -1;
};
const nextSibling = (rows: Row[], i: number) => {
  const j = blockEnd(rows, i);
  return j < rows.length && rows[j].depth === rows[i].depth ? j : -1;
};

const blankRow = (depth: number): Row => ({ key: uid("new"), depth, label: "", link_type: "url", link_id: null, url: "", group_heading: "", image_media_id: null, highlight_text: "", open_in_new_tab: false, is_active: true });

export default function NavigationPage() {
  return (
    <RequirePermission permission="navigation.manage">
      <NavigationScreen />
    </RequirePermission>
  );
}

function NavigationScreen() {
  const { data, isLoading, error, refetch } = useAdminQuery<MenusResponse>("/admin/navigation");
  const [active, setActive] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const { confirm, dialog } = useConfirm();
  const menus = data?.data ?? [];
  const current = menus.find((m) => m.id === active) ?? menus[0];

  const switchTo = (id: number) => {
    if (id === current?.id) return;
    if (!dirty) return setActive(id);
    confirm({ title: "Discard unsaved menu changes?", description: "Switching menus will lose the edits you haven’t saved.", confirmLabel: "Discard and switch", destructive: true, action: () => { setDirty(false); setActive(id); } });
  };

  return (
    <>
      <PageHeader title="Navigation Menus" description="Edit the storefront header, footer and mobile menus. Items linking to unpublished pages or products are hidden automatically." />
      {isLoading ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorNotice error={error} onRetry={() => refetch()} />
      ) : !current ? (
        <EmptyState title="No menus configured" />
      ) : (
        <>
          <div className="mb-5">
            <Tabs tabs={menus.map((m) => ({ value: String(m.id), label: LOCATION_LABELS[m.location] ?? m.name }))} active={String(current.id)} onChange={(v) => switchTo(Number(v))} />
          </div>
          <MenuEditor key={current.id} menu={current} routes={data.meta.routes} linkTypes={data.meta.link_types} onDirtyChange={setDirty} />
        </>
      )}
      {dialog}
    </>
  );
}

function MenuEditor({ menu, routes, linkTypes, onDirtyChange }: { menu: Menu; routes: string[]; linkTypes: LinkType[]; onDirtyChange: (d: boolean) => void }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() => flatten(menu.items));
  const [saved, setSaved] = useState(() => snapshot(build(flatten(menu.items))));
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const { confirm, dialog } = useConfirm();
  const tree = useMemo(() => build(rows), [rows]);
  const dirty = snapshot(tree) !== saved;
  useUnsavedChangesWarning(dirty);
  const paths = useMemo(() => rowPaths(rows), [rows]);

  const updateRows = (next: Row[]) => {
    setRows(next);
    onDirtyChange(snapshot(build(next)) !== saved);
  };
  const patch = (key: string, p: Partial<Row>) => updateRows(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const toggleOpen = (key: string, force?: boolean) => setOpen((s) => {
    const n = new Set(s);
    if (force ?? !n.has(key)) n.add(key);
    else n.delete(key);
    return n;
  });

  const save = useAdminMutation(() => adminApi.put<MenusResponse>(`/admin/navigation/${menu.id}`, { items: tree }), {
    success: `${LOCATION_LABELS[menu.location] ?? menu.name} saved`,
    onSuccess: (r) => {
      const fresh = r.data.find((m) => m.id === menu.id);
      if (fresh) {
        const next = flatten(fresh.items);
        setRows(next);
        setSaved(snapshot(build(next)));
        setOpen(new Set());
      }
      onDirtyChange(false);
      queryClient.setQueryData(["admin", "/admin/navigation", {}], r);
    },
  });
  const errs = save.fieldErrors;
  const rowErrors = (path: string) => Object.entries(errs).filter(([k]) => k.startsWith(`${path}.`) && !k.slice(path.length + 1).startsWith("children")).map(([k, v]) => [k.slice(path.length + 1), v[0]] as const);

  // ---- tree operations ----
  const move = (i: number, dir: -1 | 1) => {
    const j = dir === -1 ? prevSibling(rows, i) : nextSibling(rows, i);
    if (j < 0) return;
    const [a, b] = dir === -1 ? [j, i] : [i, j];
    const aBlock = rows.slice(a, blockEnd(rows, a));
    const bBlock = rows.slice(b, blockEnd(rows, b));
    updateRows([...rows.slice(0, a), ...bBlock, ...aBlock, ...rows.slice(b + bBlock.length)]);
  };
  const canIndent = (i: number) => prevSibling(rows, i) >= 0 && rows[i].depth + subtreeHeight(rows, i) < MAX_DEPTH;
  const indent = (i: number) => {
    if (!canIndent(i)) return;
    const end = blockEnd(rows, i);
    updateRows(rows.map((r, k) => (k >= i && k < end ? { ...r, depth: r.depth + 1 } : r)));
  };
  const outdent = (i: number) => {
    if (rows[i].depth === 0) return;
    const end = blockEnd(rows, i);
    const block = rows.slice(i, end).map((r) => ({ ...r, depth: r.depth - 1 }));
    // Find the end of the parent's block so following siblings don't become children.
    let parent = i - 1;
    while (rows[parent].depth >= rows[i].depth) parent -= 1;
    const parentEnd = blockEnd(rows, parent);
    const without = [...rows.slice(0, i), ...rows.slice(end)];
    const insertAt = parentEnd - block.length;
    updateRows([...without.slice(0, insertAt), ...block, ...without.slice(insertAt)]);
  };
  const addChild = (i: number) => {
    const row = blankRow(rows[i].depth + 1);
    const end = blockEnd(rows, i);
    updateRows([...rows.slice(0, end), row, ...rows.slice(end)]);
    toggleOpen(row.key, true);
  };
  const addTop = () => {
    const row = blankRow(0);
    updateRows([...rows, row]);
    toggleOpen(row.key, true);
  };
  const remove = (i: number) => {
    const end = blockEnd(rows, i);
    const doRemove = () => updateRows([...rows.slice(0, i), ...rows.slice(end)]);
    if (end - i > 1) confirm({ title: `Remove “${rows[i].label || "Untitled"}” and its ${end - i - 1} sub-item${end - i - 1 > 1 ? "s" : ""}?`, description: "The change is applied when you save the menu.", confirmLabel: "Remove", destructive: true, action: doRemove });
    else doRemove();
  };
  const reset = () => confirm({ title: "Discard unsaved changes?", confirmLabel: "Discard", destructive: true, action: () => { updateRows(flatten(menu.items)); save.setFieldErrors({}); } });

  const errorCount = Object.keys(errs).length;

  return (
    <>
      <Card
        title={LOCATION_LABELS[menu.location] ?? menu.name}
        description={menu.location === "header" ? "Top-level items appear in the header. Sub-items form the mega menu; use “column heading” to group them." : "Up to three levels deep."}
        actions={
          <div className="flex flex-wrap gap-2">
            {dirty && <Button size="sm" variant="ghost" onClick={reset}>Discard</Button>}
            <Button size="sm" variant="secondary" onClick={addTop}><Plus className="h-3.5 w-3.5" /> Add item</Button>
            <Button size="sm" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate(undefined)}>Save menu</Button>
          </div>
        }
        padded={false}
      >
        {errorCount > 0 && <p className="border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-800" role="alert">Some items need attention — see the highlighted rows below.</p>}
        {dirty && errorCount === 0 && <p className="border-b border-amber-100 bg-amber-50 px-5 py-2 text-xs text-amber-900" role="status">Unsaved changes — the storefront updates when you save.</p>}
        {rows.length === 0 ? (
          <EmptyState title="This menu is empty" description="Add the first item." action={<Button onClick={addTop}><Plus className="h-4 w-4" /> Add item</Button>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const errors = rowErrors(paths[i]);
              const isOpen = open.has(r.key) || errors.length > 0;
              const name = r.label || "Untitled item";
              return (
                <li key={r.key} className={cn("bg-white", errors.length > 0 && "bg-red-50/50")}>
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4" style={{ paddingLeft: `${1 + r.depth * 1.75}rem` }}>
                    {r.depth > 0 && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />}
                    <button type="button" onClick={() => toggleOpen(r.key)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-royal">
                      {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                      <span className="min-w-0">
                        <span className={cn("block truncate text-sm font-medium", r.label ? "text-slate-900" : "text-slate-400 italic")}>{name}</span>
                        <span className="block truncate text-xs text-slate-500"><LinkSummary row={r} /></span>
                      </span>
                    </button>
                    <div className="flex flex-wrap gap-1">
                      {r.group_heading && <Badge tone="violet">{r.group_heading}</Badge>}
                      {r.highlight_text && <Badge tone="amber">{r.highlight_text}</Badge>}
                      {!r.is_active && <Badge>Hidden</Badge>}
                      {r.open_in_new_tab && <Badge tone="blue">New tab</Badge>}
                    </div>
                    <div className="flex items-center">
                      <IconButton label={`Move ${name} up`} disabled={prevSibling(rows, i) < 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
                      <IconButton label={`Move ${name} down`} disabled={nextSibling(rows, i) < 0} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
                      <IconButton label={`Outdent ${name}`} disabled={r.depth === 0} onClick={() => outdent(i)}><IndentDecrease className="h-3.5 w-3.5" /></IconButton>
                      <IconButton label={`Indent ${name} under previous item`} disabled={!canIndent(i)} onClick={() => indent(i)}><IndentIncrease className="h-3.5 w-3.5" /></IconButton>
                      <IconButton label={`Add sub-item to ${name}`} disabled={r.depth >= MAX_DEPTH} onClick={() => addChild(i)}><Plus className="h-3.5 w-3.5" /></IconButton>
                      <IconButton label={`Remove ${name}`} onClick={() => remove(i)} className="hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></IconButton>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4" style={{ paddingLeft: `${1 + r.depth * 1.75}rem` }}>
                      <ItemFields row={r} routes={routes} linkTypes={linkTypes} onChange={(p) => patch(r.key, p)} errors={Object.fromEntries(errors)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {dialog}
    </>
  );
}

function LinkSummary({ row }: { row: Row }) {
  const kind = LOOKUP_FOR[row.link_type];
  const { options } = useLookup(kind ?? "pages", !!kind && !!row.link_id);
  if (row.link_type === "url") return <>{row.url || "No URL set"}</>;
  if (row.link_type === "route") return <>{row.url ? `${ROUTE_LABELS[row.url] ?? row.url}` : "No page chosen"}</>;
  if (!row.link_id) return <>{LINK_TYPE_LABELS[row.link_type]}: not chosen</>;
  return <>{LINK_TYPE_LABELS[row.link_type]}: {options.find((o) => o.value === row.link_id)?.label ?? `#${row.link_id}`}</>;
}

function ItemFields({ row, routes, linkTypes, onChange, errors }: { row: Row; routes: string[]; linkTypes: LinkType[]; onChange: (p: Partial<Row>) => void; errors: Record<string, string> }) {
  const kind = LOOKUP_FOR[row.link_type];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <F label="Label" required error={errors.label}>
        {(id) => <Input id={id} value={row.label} maxLength={120} onChange={(e) => onChange({ label: e.target.value })} invalid={!!errors.label} />}
      </F>
      <F label="Links to" error={errors.link_type}>
        {(id) => (
          <Select id={id} value={row.link_type} onChange={(e) => onChange({ link_type: e.target.value as LinkType, link_id: null, url: "" })}>
            {linkTypes.map((t) => <option key={t} value={t}>{LINK_TYPE_LABELS[t] ?? t}</option>)}
          </Select>
        )}
      </F>
      {row.link_type === "url" ? (
        <F label="URL" error={errors.url} hint="A path like /shop/sarees, or https://, mailto: or tel: links.">
          {(id) => <Input id={id} value={row.url} maxLength={500} placeholder="/shop" onChange={(e) => onChange({ url: e.target.value })} invalid={!!errors.url} />}
        </F>
      ) : row.link_type === "route" ? (
        <F label="Storefront page" required error={errors.url}>
          {(id) => (
            <Select id={id} value={row.url} onChange={(e) => onChange({ url: e.target.value })} invalid={!!errors.url}>
              <option value="">— Choose a page —</option>
              {routes.map((r) => <option key={r} value={r}>{ROUTE_LABELS[r] ?? r}</option>)}
            </Select>
          )}
        </F>
      ) : kind ? (
        <F label={LINK_TYPE_LABELS[row.link_type]} required error={errors.link_id}>
          {(id) => <LookupSelect id={id} kind={kind} value={row.link_id} onChange={(v) => onChange({ link_id: v })} invalid={!!errors.link_id} />}
        </F>
      ) : null}
      <F label="Column heading" error={errors.group_heading} hint="Mega-menu column this item sits under (e.g. “By craft”).">
        {(id) => <Input id={id} value={row.group_heading} maxLength={120} onChange={(e) => onChange({ group_heading: e.target.value })} />}
      </F>
      <F label="Highlight text" error={errors.highlight_text} hint="Small badge such as “New”.">
        {(id) => <Input id={id} value={row.highlight_text} maxLength={120} onChange={(e) => onChange({ highlight_text: e.target.value })} />}
      </F>
      <Field label="Image" error={errors.image_media_id} hint="Optional feature image for mega menus.">
        <MediaIdField value={row.image_media_id} onChange={(v) => onChange({ image_media_id: v })} />
      </Field>
      <div className="space-y-3 md:col-span-2 xl:col-span-3">
        <Checkbox checked={row.is_active} onChange={(e) => onChange({ is_active: e.target.checked })} label="Active" description="Inactive items are kept but not shown on the storefront." />
        <Checkbox checked={row.open_in_new_tab} onChange={(e) => onChange({ open_in_new_tab: e.target.checked })} label="Open in a new tab" />
      </div>
      {Object.entries(errors).filter(([k]) => !["label", "link_type", "url", "link_id", "group_heading", "highlight_text", "image_media_id"].includes(k)).map(([k, v]) => (
        <p key={k} className="text-xs text-red-700 md:col-span-2" role="alert">{v}</p>
      ))}
    </div>
  );
}

function F({ label, hint, error, required, children }: { label: string; hint?: string; error?: string; required?: boolean; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      {children(id)}
    </Field>
  );
}
