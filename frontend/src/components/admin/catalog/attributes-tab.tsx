"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Badge, Button, Card, type Column, DataTable, EmptyState, ErrorNotice, Field, Input, Modal, MultiCheck, Select, Spinner, Switch } from "@/components/admin/ui";
import { adminApi, useAdminMutation, useAdminQuery } from "@/lib/admin/hooks";
import { slugify, toInt } from "./form-utils";
import { FormSection, TextField, useDeleteConfirm } from "./shared";
import { ATTRIBUTE_GROUPS, ATTRIBUTE_TYPES, type Attribute, type AttributeType, type Category, type Department } from "./types";

const ATTRIBUTES_KEY = ["admin", "/admin/attributes"];
const TYPE_LABELS: Record<AttributeType, string> = { text: "Text", textarea: "Long text", select: "Single choice", multiselect: "Multiple choice", boolean: "Yes / no" };
const hasValues = (t: AttributeType) => t === "select" || t === "multiselect";

export function AttributesTab() {
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: Attribute[] }>("/admin/attributes");
  const categories = useAdminQuery<{ data: Category[] }>("/admin/categories");
  const departments = useAdminQuery<{ data: Department[] }>("/admin/departments");
  const [editing, setEditing] = useState<{ item: Attribute | null } | null>(null);
  const { confirmDelete, dialog } = useDeleteConfirm();

  const categoryNames = useMemo(() => new Map((categories.data?.data ?? []).map((c) => [c.id, c.name])), [categories.data]);

  const columns: Column<Attribute>[] = [
    {
      key: "name",
      header: "Attribute",
      cell: (a) => (
        <div>
          <p className="font-medium text-slate-900">{a.name}</p>
          <p className="font-mono text-xs text-slate-500">{a.code}</p>
        </div>
      ),
    },
    { key: "type", header: "Type", cell: (a) => <span className="text-slate-700">{TYPE_LABELS[a.type] ?? a.type}</span> },
    { key: "group", header: "Group", cell: (a) => <Badge>{a.group}</Badge> },
    {
      key: "flags",
      header: "Storefront",
      cell: (a) => (
        <div className="flex flex-wrap gap-1">
          {a.is_filterable ? <Badge tone="blue">Filter</Badge> : null}
          {a.is_visible ? <Badge tone="green">Visible</Badge> : <Badge>Hidden</Badge>}
        </div>
      ),
    },
    { key: "values", header: "Values", cell: (a) => (hasValues(a.type) ? <span className="tabular-nums">{a.values.length}</span> : <span className="text-slate-400">—</span>) },
    {
      key: "categories",
      header: "Categories",
      hideOnMobile: false,
      cell: (a) => {
        if (!a.category_ids.length) return <span className="text-xs text-slate-400">None</span>;
        const names = a.category_ids.map((id) => categoryNames.get(id)).filter(Boolean) as string[];
        return (
          <span className="text-xs text-slate-600" title={names.join(", ")}>
            {names.slice(0, 3).join(", ")}
            {a.category_ids.length > 3 && ` +${a.category_ids.length - 3} more`}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      cell: (a) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing({ item: a })} aria-label={`Edit ${a.name}`}><Pencil className="h-4 w-4" /></Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete ${a.name}`}
            onClick={() => confirmDelete({
              title: `Delete attribute “${a.name}”?`,
              description: "Products are not deleted, but every value they have recorded for this attribute is removed, and it disappears from shop filters.",
              path: `/admin/attributes/${a.id}`,
              invalidate: [ATTRIBUTES_KEY, ["admin", "/admin/categories"]],
              success: "Attribute deleted",
            })}
          >
            <Trash2 className="h-4 w-4 text-red-700" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card
      title="Product attributes"
      description="Structured details such as fabric, work or care. Filterable attributes become shop filters for the categories they are assigned to."
      padded={false}
      actions={<Button size="sm" onClick={() => setEditing({ item: null })}><Plus className="h-4 w-4" /> New attribute</Button>}
    >
      {error ? (
        <div className="p-5"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
      ) : (
        <DataTable columns={columns} rows={data?.data} rowKey={(a) => a.id} loading={isLoading} empty={<EmptyState title="No attributes yet" description="Create attributes like Fabric or Embroidery to describe products consistently." />} />
      )}
      {editing && (
        <AttributeModal
          key={editing.item?.id ?? "new"}
          attribute={editing.item}
          categories={categories.data?.data}
          departments={departments.data?.data}
          onClose={() => setEditing(null)}
        />
      )}
      {dialog}
    </Card>
  );
}

type ValueRow = { key: string; id?: number; value: string };
let rowSeq = 0;
const newRowKey = () => `row-${++rowSeq}`;

function AttributeModal({ attribute, categories, departments, onClose }: { attribute: Attribute | null; categories?: Category[]; departments?: Department[]; onClose: () => void }) {
  const formId = useId();
  const typeId = useId();
  const groupId = useId();
  const [codeTouched, setCodeTouched] = useState(!!attribute);
  const [form, setForm] = useState({
    name: attribute?.name ?? "",
    code: attribute?.code ?? "",
    type: (attribute?.type ?? "select") as AttributeType,
    group: attribute?.group ?? "details",
    is_filterable: attribute?.is_filterable ?? false,
    is_visible: attribute?.is_visible ?? true,
    sort_order: String(attribute?.sort_order ?? 0),
    category_ids: attribute?.category_ids ?? [],
  });
  const [values, setValues] = useState<ValueRow[]>(() => (attribute?.values ?? []).map((v) => ({ key: `saved-${v.id}`, id: v.id, value: v.value })));
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const save = useAdminMutation(
    (body: Record<string, unknown>) => (attribute ? adminApi.patch(`/admin/attributes/${attribute.id}`, body) : adminApi.post("/admin/attributes", body)),
    { success: attribute ? "Attribute updated" : "Attribute created", invalidate: [ATTRIBUTES_KEY, ["admin", "/admin/categories"]], onSuccess: onClose },
  );

  const categoryOptions = useMemo(() => {
    if (!categories) return [];
    const deptName = new Map((departments ?? []).map((d) => [d.id, d.name]));
    // API orders by department then depth; regroup depth-first for readable indentation.
    const out: { value: number; label: string; hint?: string; depth?: number }[] = [];
    const children = (parent: number | null, dept: number) => categories.filter((c) => c.parent_id === parent && c.department_id === dept).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const walk = (parent: number | null, dept: number) => {
      for (const c of children(parent, dept)) {
        out.push({ value: c.id, label: c.name, hint: c.depth === 0 ? deptName.get(dept) : undefined, depth: c.depth });
        walk(c.id, dept);
      }
    };
    const deptIds = [...new Set([...(departments ?? []).map((d) => d.id), ...categories.map((c) => c.department_id)])];
    deptIds.forEach((d) => walk(null, d));
    return out;
  }, [categories, departments]);

  const moveValue = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    setValues(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      name: form.name.trim(),
      code: form.code.trim(),
      type: form.type,
      group: form.group,
      is_filterable: form.is_filterable,
      is_visible: form.is_visible,
      sort_order: toInt(form.sort_order),
      category_ids: form.category_ids,
      // Values only apply to choice types; other types keep whatever is stored.
      ...(hasValues(form.type) ? { values: values.map((v) => (v.id ? { id: v.id, value: v.value.trim() } : { value: v.value.trim() })) } : {}),
    });
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={attribute ? `Edit ${attribute.name}` : "New attribute"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} loading={save.isPending}>{attribute ? "Save changes" : "Create attribute"}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-6" noValidate>
        <FormSection title="Definition">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" required value={form.name} onChange={(v) => set({ name: v, ...(codeTouched ? {} : { code: slugify(v) }) })} error={save.fieldError("name")} maxLength={100} />
            <TextField
              label="Code"
              required
              value={form.code}
              onChange={(v) => { setCodeTouched(true); set({ code: v.toLowerCase().replace(/[^a-z0-9-]/g, "-") }); }}
              error={save.fieldError("code")}
              maxLength={60}
              inputClassName="font-mono"
              hint={attribute ? "Used in filter URLs — changing it breaks existing links." : "Lowercase letters, numbers and hyphens (used in filter URLs)."}
            />
            <Field label="Type" htmlFor={typeId} required error={save.fieldError("type")}>
              <Select id={typeId} value={form.type} onChange={(e) => set({ type: e.target.value as AttributeType })}>
                {ATTRIBUTE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </Select>
            </Field>
            <Field label="Group" htmlFor={groupId} required error={save.fieldError("group")} hint="Where it appears on the product page.">
              <Select id={groupId} value={form.group} onChange={(e) => set({ group: e.target.value as typeof form.group })}>
                {ATTRIBUTE_GROUPS.map((g) => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}
              </Select>
            </Field>
            <TextField label="Sort order" type="number" value={form.sort_order} onChange={(v) => set({ sort_order: v })} error={save.fieldError("sort_order")} />
          </div>
          <div className="space-y-4 rounded-md border border-slate-200 p-4">
            <Switch label="Filterable" description="Offer as a filter on category pages it is assigned to." checked={form.is_filterable} onCheckedChange={(v) => set({ is_filterable: v })} />
            <Switch label="Visible on product page" description="Show the value in the product details." checked={form.is_visible} onCheckedChange={(v) => set({ is_visible: v })} />
          </div>
        </FormSection>

        {hasValues(form.type) && (
          <FormSection title={`Values (${values.length})`}>
            {save.fieldError("values") && <p className="text-xs text-red-700" role="alert">{save.fieldError("values")}</p>}
            {values.length === 0 && <p className="text-sm text-slate-500">No values yet. Add the choices editors can pick from.</p>}
            <ol className="space-y-2">
              {values.map((row, i) => {
                const err = save.fieldError(`values.${i}.value`);
                return (
                  <li key={row.key}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 text-right text-xs text-slate-400 tabular-nums">{i + 1}</span>
                      <Input
                        value={row.value}
                        onChange={(e) => setValues(values.map((v) => (v.key === row.key ? { ...v, value: e.target.value } : v)))}
                        aria-label={`Value ${i + 1}`}
                        invalid={!!err}
                        maxLength={150}
                        className="h-9"
                      />
                      <Button size="sm" variant="ghost" onClick={() => moveValue(i, -1)} disabled={i === 0} aria-label={`Move value ${i + 1} up`}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => moveValue(i, 1)} disabled={i === values.length - 1} aria-label={`Move value ${i + 1} down`}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setValues(values.filter((v) => v.key !== row.key))} aria-label={`Remove value ${i + 1}`}><X className="h-4 w-4" /></Button>
                    </div>
                    {err && <p className="mt-1 ml-8 text-xs text-red-700" role="alert">{err}</p>}
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button size="sm" variant="secondary" onClick={() => setValues([...values, { key: newRowKey(), value: "" }])}><Plus className="h-4 w-4" /> Add value</Button>
              {attribute && <p className="text-xs text-slate-500">Removing a saved value also clears it from products that use it.</p>}
            </div>
          </FormSection>
        )}

        <FormSection title="Categories">
          <Field hint="Assigned categories offer this attribute in the product editor and as a shop filter." error={save.fieldError("category_ids")}>
            {categories ? (
              categoryOptions.length ? <MultiCheck options={categoryOptions} value={form.category_ids} onChange={(v) => set({ category_ids: v })} /> : <p className="text-sm text-slate-500">No categories exist yet.</p>
            ) : (
              <Spinner label="Loading categories" />
            )}
          </Field>
        </FormSection>
      </form>
    </Modal>
  );
}
