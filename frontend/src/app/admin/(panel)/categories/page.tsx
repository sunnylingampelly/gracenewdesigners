"use client";

import { ArrowDown, ArrowUp, ExternalLink, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { MediaField } from "@/components/admin/media-picker";
import { Badge, Button, Card, type Column, DataTable, EmptyState, ErrorNotice, Field, Modal, MultiCheck, PageHeader, Select, Spinner, Switch } from "@/components/admin/ui";
import { slugify, textOrNull, toInt } from "@/components/admin/catalog/form-utils";
import { FormSection, SeoFields, TextAreaField, TextField, Thumb, useDeleteConfirm } from "@/components/admin/catalog/shared";
import type { Attribute, Category, Department, SizeChart } from "@/components/admin/catalog/types";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation, useAdminQuery } from "@/lib/admin/hooks";

const DEPARTMENTS_KEY = ["admin", "/admin/departments"];
const CATEGORIES_KEY = ["admin", "/admin/categories"];

export default function CategoriesPage() {
  return (
    <RequirePermission permission={["taxonomy.manage", "products.view"]}>
      <PageHeader
        title="Categories"
        description="Departments are the top level of the shop (Men, Formal, Ethnic, Accessories…). Categories nest inside a department and form the /shop URLs and menus."
      />
      <div className="space-y-8">
        <DepartmentsSection />
        <CategoryTreeSection />
      </div>
    </RequirePermission>
  );
}

// ---- Departments ---------------------------------------------------------------------------------

function DepartmentsSection() {
  const { can } = useAuth();
  const canManage = can("taxonomy.manage");
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: Department[] }>("/admin/departments");
  const [editing, setEditing] = useState<{ item: Department | null } | null>(null);
  const { confirmDelete, dialog } = useDeleteConfirm();

  const columns: Column<Department>[] = [
    {
      key: "name",
      header: "Department",
      cell: (d) => (
        <div className="flex items-center gap-3">
          <Thumb url={d.banner_url} />
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{d.name}</p>
            <p className="truncate font-mono text-xs text-slate-500">/{d.slug}</p>
          </div>
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (d) => (d.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>) },
    { key: "categories", header: "Categories", cell: (d) => <span className="tabular-nums">{d.categories_count}</span> },
    { key: "products", header: "Products", cell: (d) => <span className="tabular-nums">{d.products_count}</span> },
    { key: "sort", header: "Order", cell: (d) => <span className="tabular-nums text-slate-500">{d.sort_order}</span>, hideOnMobile: true },
    ...(canManage
      ? [{
          key: "actions",
          header: <span className="sr-only">Actions</span>,
          className: "text-right",
          cell: (d: Department) => (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing({ item: d })} aria-label={`Edit ${d.name}`}><Pencil className="h-4 w-4" /></Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${d.name}`}
                onClick={() => confirmDelete({
                  title: `Delete department “${d.name}”?`,
                  description: d.categories_count || d.products_count
                    ? `It still has ${d.categories_count} categories and ${d.products_count} products, so the server will refuse. Deactivate it instead, or move them first.`
                    : "This permanently removes the department.",
                  path: `/admin/departments/${d.id}`,
                  invalidate: [DEPARTMENTS_KEY, CATEGORIES_KEY],
                  success: "Department deleted",
                })}
              >
                <Trash2 className="h-4 w-4 text-red-700" />
              </Button>
            </div>
          ),
        } satisfies Column<Department>]
      : []),
  ];

  return (
    <Card
      title="Departments"
      description="Top-level sections of the shop. Inactive departments are hidden from the storefront."
      padded={false}
      actions={canManage ? <Button size="sm" onClick={() => setEditing({ item: null })}><Plus className="h-4 w-4" /> New department</Button> : undefined}
    >
      {error ? (
        <div className="p-5"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
      ) : (
        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(d) => d.id}
          loading={isLoading}
          empty={<EmptyState title="No departments yet" description="Create a department such as Men, Formal or Ethnic to start organising categories." />}
        />
      )}
      {editing && <DepartmentModal key={editing.item?.id ?? "new"} department={editing.item} onClose={() => setEditing(null)} />}
      {dialog}
    </Card>
  );
}

function DepartmentModal({ department, onClose }: { department: Department | null; onClose: () => void }) {
  const formId = useId();
  const [form, setForm] = useState({
    name: department?.name ?? "",
    slug: department?.slug ?? "",
    description: department?.description ?? "",
    banner_media_id: department?.banner_media_id ?? null,
    sort_order: String(department?.sort_order ?? 0),
    is_active: department?.is_active ?? true,
    seo_title: department?.seo_title ?? "",
    seo_description: department?.seo_description ?? "",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useAdminMutation(
    (body: Record<string, unknown>) => (department ? adminApi.patch(`/admin/departments/${department.id}`, body) : adminApi.post("/admin/departments", body)),
    { success: department ? "Department updated" : "Department created", invalidate: [DEPARTMENTS_KEY, CATEGORIES_KEY], onSuccess: onClose },
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      name: form.name.trim(),
      slug: textOrNull(form.slug),
      description: textOrNull(form.description),
      banner_media_id: form.banner_media_id,
      sort_order: toInt(form.sort_order),
      is_active: form.is_active,
      seo_title: textOrNull(form.seo_title),
      seo_description: textOrNull(form.seo_description),
    });
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={department ? `Edit ${department.name}` : "New department"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} loading={save.isPending}>{department ? "Save changes" : "Create department"}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" required value={form.name} onChange={(v) => set({ name: v })} error={save.fieldError("name")} maxLength={120} />
          <TextField
            label="Slug"
            value={form.slug}
            onChange={(v) => set({ slug: v.toLowerCase() })}
            error={save.fieldError("slug")}
            placeholder={slugify(form.name)}
            hint={department && form.slug !== department.slug ? "Changing the slug updates every category URL in this department (redirects are recorded)." : "Lowercase letters, numbers and hyphens. Leave blank to generate from the name."}
            maxLength={120}
          />
        </div>
        <TextAreaField label="Description" value={form.description} onChange={(v) => set({ description: v })} error={save.fieldError("description")} maxLength={2000} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Banner image" error={save.fieldError("banner_media_id")}>
            <MediaField value={form.banner_media_id} preview={department?.banner_url} onChange={(id) => set({ banner_media_id: id })} label="Choose banner" />
          </Field>
          <TextField label="Sort order" type="number" value={form.sort_order} onChange={(v) => set({ sort_order: v })} error={save.fieldError("sort_order")} hint="Lower numbers appear first." />
        </div>
        <Switch label="Active" description="Inactive departments and their categories are hidden from shoppers." checked={form.is_active} onCheckedChange={(v) => set({ is_active: v })} />
        <SeoFields value={form} onChange={(v) => set(v)} fieldError={save.fieldError} />
      </form>
    </Modal>
  );
}

// ---- Category tree -------------------------------------------------------------------------------

type TreeRow = Category & { siblings: Category[]; index: number; hasChildren: boolean };

/** Orders the flat API list depth-first, siblings by sort_order then name. */
function buildDepartmentTree(categories: Category[], departmentId: number): TreeRow[] {
  const byParent = new Map<number | null, Category[]>();
  for (const c of categories) {
    if (c.department_id !== departmentId) continue;
    const list = byParent.get(c.parent_id) ?? [];
    list.push(c);
    byParent.set(c.parent_id, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const ids = new Set(categories.filter((c) => c.department_id === departmentId).map((c) => c.id));
  const out: TreeRow[] = [];
  const walk = (parentId: number | null) => {
    const siblings = byParent.get(parentId) ?? [];
    siblings.forEach((c, index) => {
      out.push({ ...c, siblings, index, hasChildren: (byParent.get(c.id)?.length ?? 0) > 0 });
      walk(c.id);
    });
  };
  walk(null);
  // Orphans whose parent sits in another department (should not happen) still get listed.
  for (const [parentId, list] of byParent) {
    if (parentId !== null && !ids.has(parentId)) list.forEach((c, index) => out.push({ ...c, siblings: list, index, hasChildren: false }));
  }
  return out;
}

function CategoryTreeSection() {
  const { can } = useAuth();
  const canManage = can("taxonomy.manage");
  const departments = useAdminQuery<{ data: Department[] }>("/admin/departments");
  const categories = useAdminQuery<{ data: Category[] }>("/admin/categories");
  const [editing, setEditing] = useState<{ item: Category | null; departmentId?: number; parentId?: number | null } | null>(null);
  const { confirmDelete, dialog } = useDeleteConfirm();

  const reorder = useAdminMutation((items: { id: number; sort_order: number }[]) => adminApi.post("/admin/categories/reorder", { items }), {
    success: "Order updated",
    invalidate: [CATEGORIES_KEY],
  });

  const move = (row: TreeRow, delta: -1 | 1) => {
    const next = [...row.siblings];
    const target = row.index + delta;
    if (target < 0 || target >= next.length) return;
    [next[row.index], next[target]] = [next[target], next[row.index]];
    reorder.mutate(next.map((c, i) => ({ id: c.id, sort_order: i })));
  };

  const trees = useMemo(() => {
    if (!departments.data || !categories.data) return [];
    return departments.data.data.map((d) => ({ department: d, rows: buildDepartmentTree(categories.data.data, d.id) }));
  }, [departments.data, categories.data]);

  const error = departments.error ?? categories.error;

  return (
    <section aria-labelledby="category-tree-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="category-tree-heading" className="text-lg font-semibold text-slate-900">Category tree</h2>
          <p className="text-sm text-slate-500">Use the arrows to reorder categories among their siblings. Paths become /shop/… URLs.</p>
        </div>
        {canManage && departments.data && departments.data.data.length > 0 && (
          <Button onClick={() => setEditing({ item: null })}><Plus className="h-4 w-4" /> New category</Button>
        )}
      </div>

      {error ? (
        <ErrorNotice error={error} onRetry={() => { void departments.refetch(); void categories.refetch(); }} />
      ) : departments.isLoading || categories.isLoading ? (
        <Spinner label="Loading categories" />
      ) : trees.length === 0 ? (
        <Card><EmptyState title="No departments yet" description="Create a department above before adding categories." /></Card>
      ) : (
        trees.map(({ department, rows }) => (
          <Card
            key={department.id}
            padded={false}
            title={<span className="flex items-center gap-2">{department.name}{!department.is_active && <Badge>Inactive</Badge>}</span>}
            description={`${rows.length} ${rows.length === 1 ? "category" : "categories"} · /shop/${department.slug}`}
            actions={canManage ? (
              <Button size="sm" variant="secondary" onClick={() => setEditing({ item: null, departmentId: department.id, parentId: null })}>
                <Plus className="h-4 w-4" /> Add category
              </Button>
            ) : undefined}
          >
            {rows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No categories in this department yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100" aria-label={`${department.name} categories`}>
                {rows.map((row) => (
                  <li key={row.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center" style={{ paddingLeft: `${1 + row.depth * 1.5}rem` }}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {row.depth > 0 && <span className="text-slate-300" aria-hidden>└</span>}
                      <Thumb url={row.image_url} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                          {row.name}
                          {row.is_published ? <Badge tone="green">Published</Badge> : <Badge>Hidden</Badge>}
                          {row.show_in_menu ? <Badge tone="blue">In menu</Badge> : <Badge tone="amber">Not in menu</Badge>}
                        </p>
                        <a href={`/shop/${row.path}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 truncate font-mono text-xs text-slate-500 hover:text-slate-800 hover:underline">
                          /shop/{row.path} <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="text-xs text-slate-500 tabular-nums">{row.products_count} {row.products_count === 1 ? "product" : "products"}</span>
                      {canManage && (
                        <div className="flex items-center gap-0.5">
                          <Button size="sm" variant="ghost" onClick={() => move(row, -1)} disabled={row.index === 0 || reorder.isPending} aria-label={`Move ${row.name} up`}><ArrowUp className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => move(row, 1)} disabled={row.index === row.siblings.length - 1 || reorder.isPending} aria-label={`Move ${row.name} down`}><ArrowDown className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing({ item: null, departmentId: row.department_id, parentId: row.id })} aria-label={`Add subcategory to ${row.name}`}><FolderPlus className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing({ item: row })} aria-label={`Edit ${row.name}`}><Pencil className="h-4 w-4" /></Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${row.name}`}
                            onClick={() => confirmDelete({
                              title: `Delete “${row.name}”?`,
                              description: row.hasChildren
                                ? "This category has subcategories, so the server will refuse. Move or delete the subcategories first."
                                : `Products are NOT deleted — the ${row.products_count} ${row.products_count === 1 ? "product" : "products"} in this category will only be unlinked from it. The /shop/${row.path} page will stop working.`,
                              path: `/admin/categories/${row.id}`,
                              invalidate: [CATEGORIES_KEY, DEPARTMENTS_KEY],
                              success: "Category deleted",
                            })}
                          >
                            <Trash2 className="h-4 w-4 text-red-700" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))
      )}

      {editing && departments.data && categories.data && (
        <CategoryModal
          key={editing.item?.id ?? `new-${editing.departmentId}-${editing.parentId}`}
          category={editing.item}
          defaultDepartmentId={editing.departmentId ?? departments.data.data[0]?.id}
          defaultParentId={editing.parentId ?? null}
          departments={departments.data.data}
          categories={categories.data.data}
          onClose={() => setEditing(null)}
        />
      )}
      {dialog}
    </section>
  );
}

function CategoryModal({ category, defaultDepartmentId, defaultParentId, departments, categories, onClose }: {
  category: Category | null;
  defaultDepartmentId?: number;
  defaultParentId: number | null;
  departments: Department[];
  categories: Category[];
  onClose: () => void;
}) {
  const formId = useId();
  const deptId = useId();
  const parentId = useId();
  const chartId = useId();
  const sizeCharts = useAdminQuery<{ data: SizeChart[] }>("/admin/size-charts");
  const attributes = useAdminQuery<{ data: Attribute[] }>("/admin/attributes");

  const [form, setForm] = useState({
    department_id: category?.department_id ?? defaultDepartmentId ?? 0,
    parent_id: category ? category.parent_id : defaultParentId,
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    intro: category?.intro ?? "",
    image_media_id: category?.image_media_id ?? null,
    banner_media_id: category?.banner_media_id ?? null,
    size_chart_id: category?.size_chart_id ?? null,
    sort_order: String(category?.sort_order ?? 0),
    is_published: category?.is_published ?? true,
    show_in_menu: category?.show_in_menu ?? true,
    hide_when_empty: category?.hide_when_empty ?? false,
    seo_title: category?.seo_title ?? "",
    seo_description: category?.seo_description ?? "",
    attribute_ids: category?.attribute_ids ?? [],
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // A category cannot be moved under itself or one of its descendants.
  const excluded = useMemo(() => {
    const out = new Set<number>();
    if (!category) return out;
    const stack = [category.id];
    while (stack.length) {
      const id = stack.pop()!;
      out.add(id);
      for (const c of categories) if (c.parent_id === id) stack.push(c.id);
    }
    return out;
  }, [category, categories]);

  const parentOptions = useMemo(() => {
    const ordered = buildDepartmentTree(categories, form.department_id);
    return ordered.filter((c) => !excluded.has(c.id));
  }, [categories, form.department_id, excluded]);

  const department = departments.find((d) => d.id === form.department_id);
  const parent = categories.find((c) => c.id === form.parent_id);
  const pathPreview = `/shop/${parent ? parent.path : department?.slug ?? ""}/${slugify(form.slug || form.name) || "…"}`;

  const save = useAdminMutation(
    (body: Record<string, unknown>) => (category ? adminApi.patch(`/admin/categories/${category.id}`, body) : adminApi.post("/admin/categories", body)),
    { success: category ? "Category updated" : "Category created", invalidate: [CATEGORIES_KEY, DEPARTMENTS_KEY, ["admin", "/admin/attributes"]], onSuccess: onClose },
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      department_id: form.department_id || null,
      parent_id: form.parent_id,
      name: form.name.trim(),
      slug: textOrNull(form.slug),
      intro: textOrNull(form.intro),
      image_media_id: form.image_media_id,
      banner_media_id: form.banner_media_id,
      size_chart_id: form.size_chart_id,
      sort_order: toInt(form.sort_order),
      is_published: form.is_published,
      show_in_menu: form.show_in_menu,
      hide_when_empty: form.hide_when_empty,
      seo_title: textOrNull(form.seo_title),
      seo_description: textOrNull(form.seo_description),
      attribute_ids: form.attribute_ids,
    });
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={category ? `Edit ${category.name}` : "New category"}
      description={category ? `Currently at /shop/${category.path}` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} loading={save.isPending}>{category ? "Save changes" : "Create category"}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-6" noValidate>
        <FormSection title="Placement">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department" htmlFor={deptId} required error={save.fieldError("department_id")}>
              <Select id={deptId} value={form.department_id || ""} onChange={(e) => set({ department_id: Number(e.target.value), parent_id: null })} invalid={!!save.fieldError("department_id")}>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Parent category" htmlFor={parentId} error={save.fieldError("parent_id")} hint="Optional — leave as top level for a main category.">
              <Select id={parentId} value={form.parent_id ?? ""} onChange={(e) => set({ parent_id: e.target.value ? Number(e.target.value) : null })} invalid={!!save.fieldError("parent_id")}>
                <option value="">— Top level of {department?.name ?? "department"} —</option>
                {parentOptions.map((c) => <option key={c.id} value={c.id}>{"  ".repeat(c.depth)}{c.depth > 0 ? "└ " : ""}{c.name}</option>)}
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" required value={form.name} onChange={(v) => set({ name: v })} error={save.fieldError("name")} maxLength={150} />
            <TextField
              label="Slug"
              value={form.slug}
              onChange={(v) => set({ slug: v.toLowerCase() })}
              error={save.fieldError("slug")}
              placeholder={slugify(form.name)}
              maxLength={150}
              hint={<>URL: <span className="font-mono">{pathPreview}</span>{category && " · old URLs redirect automatically"}</>}
            />
          </div>
          <TextAreaField label="Intro" value={form.intro} onChange={(v) => set({ intro: v })} error={save.fieldError("intro")} maxLength={3000} hint="Short paragraph shown at the top of the category page." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Thumbnail image" error={save.fieldError("image_media_id")} hint="Used in menus and category tiles.">
              <MediaField value={form.image_media_id} preview={category?.image_url} onChange={(id) => set({ image_media_id: id })} />
            </Field>
            <Field label="Banner image" error={save.fieldError("banner_media_id")} hint="Wide header image on the category page.">
              <MediaField value={form.banner_media_id} preview={category?.banner_url} onChange={(id) => set({ banner_media_id: id })} label="Choose banner" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Size chart" htmlFor={chartId} error={save.fieldError("size_chart_id")} hint="Default chart for products in this category.">
              <Select id={chartId} value={form.size_chart_id ?? ""} onChange={(e) => set({ size_chart_id: e.target.value ? Number(e.target.value) : null })} disabled={sizeCharts.isLoading}>
                <option value="">None</option>
                {sizeCharts.data?.data.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
              </Select>
            </Field>
            <TextField label="Sort order" type="number" value={form.sort_order} onChange={(v) => set({ sort_order: v })} error={save.fieldError("sort_order")} hint="Lower numbers appear first among siblings." />
          </div>
        </FormSection>

        <FormSection title="Visibility">
          <div className="space-y-4 rounded-md border border-slate-200 p-4">
            <Switch label="Published" description="Shoppers can open this category page." checked={form.is_published} onCheckedChange={(v) => set({ is_published: v })} />
            <Switch label="Show in menu" description="List this category in the storefront navigation." checked={form.show_in_menu} onCheckedChange={(v) => set({ show_in_menu: v })} />
            <Switch label="Hide when empty" description="Automatically hide from menus while it has no live products." checked={form.hide_when_empty} onCheckedChange={(v) => set({ hide_when_empty: v })} />
          </div>
        </FormSection>

        <FormSection title="Attributes">
          <Field hint="Product attributes offered when editing products in this category (and used as shop filters)." error={save.fieldError("attribute_ids")}>
            {attributes.isLoading ? (
              <Spinner label="Loading attributes" />
            ) : attributes.data?.data.length ? (
              <MultiCheck
                options={attributes.data.data.map((a) => ({ value: a.id, label: a.name, hint: `${a.group} · ${a.type}` }))}
                value={form.attribute_ids}
                onChange={(v) => set({ attribute_ids: v })}
                height="max-h-48"
              />
            ) : (
              <p className="text-sm text-slate-500">No attributes defined yet.</p>
            )}
          </Field>
        </FormSection>

        <SeoFields value={form} onChange={(v) => set(v)} fieldError={save.fieldError} />
      </form>
    </Modal>
  );
}
