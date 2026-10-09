"use client";

import { FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import { MediaField } from "@/components/admin/media-picker";
import { Badge, Button, Card, type Column, DataTable, EmptyState, ErrorNotice, Field, Modal, Select } from "@/components/admin/ui";
import { adminApi, useAdminMutation, useAdminQuery } from "@/lib/admin/hooks";
import { textOrNull } from "./form-utils";
import { FormSection, TextAreaField, TextField, useDeleteConfirm } from "./shared";
import type { SizeChart, SizeChartTable } from "./types";

const SIZE_CHARTS_KEY = ["admin", "/admin/size-charts"];
const MAX_COLUMNS = 12;
const MAX_ROWS = 40;

export function SizeChartsTab() {
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: SizeChart[] }>("/admin/size-charts");
  const [editing, setEditing] = useState<{ item: SizeChart | null } | null>(null);
  const { confirmDelete, dialog } = useDeleteConfirm();

  const columns: Column<SizeChart>[] = [
    {
      key: "name",
      header: "Size chart",
      cell: (s) => (
        <div>
          <p className="font-medium text-slate-900">{s.name}</p>
          {s.description && <p className="line-clamp-1 max-w-md text-xs text-slate-500">{s.description}</p>}
        </div>
      ),
    },
    { key: "unit", header: "Unit", cell: (s) => <Badge>{s.unit === "cm" ? "Centimetres" : "Inches"}</Badge> },
    { key: "table", header: "Table", cell: (s) => <span className="text-xs text-slate-600 tabular-nums">{s.chart ? `${s.chart.columns.length} columns × ${s.chart.rows.length} rows` : "No table"}</span> },
    {
      key: "guide",
      header: "Guide PDF",
      cell: (s) => (s.guide_url ? (
        <a href={s.guide_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-royal hover:underline"><FileText className="h-3.5 w-3.5" aria-hidden /> Download</a>
      ) : <span className="text-xs text-slate-400">—</span>),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing({ item: s })} aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" /></Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete ${s.name}`}
            onClick={() => confirmDelete({
              title: `Delete size chart “${s.name}”?`,
              description: "Categories and products using this chart will no longer show a size guide until another chart is chosen.",
              path: `/admin/size-charts/${s.id}`,
              invalidate: [SIZE_CHARTS_KEY, ["admin", "/admin/categories"]],
              success: "Size chart deleted",
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
      title="Size charts"
      description="Measurement tables shown in the size guide. Assign a default chart to categories; products can override it."
      padded={false}
      actions={<Button size="sm" onClick={() => setEditing({ item: null })}><Plus className="h-4 w-4" /> New size chart</Button>}
    >
      {error ? (
        <div className="p-5"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
      ) : (
        <DataTable columns={columns} rows={data?.data} rowKey={(s) => s.id} loading={isLoading} empty={<EmptyState title="No size charts yet" description="Create a chart such as Menswear (S–XXL)." />} />
      )}
      {editing && <SizeChartModal key={editing.item?.id ?? "new"} chart={editing.item} onClose={() => setEditing(null)} />}
      {dialog}
    </Card>
  );
}

function SizeChartModal({ chart, onClose }: { chart: SizeChart | null; onClose: () => void }) {
  const formId = useId();
  const unitId = useId();
  const [form, setForm] = useState({
    name: chart?.name ?? "",
    slug: chart?.slug ?? "",
    unit: chart?.unit ?? ("in" as "in" | "cm"),
    description: chart?.description ?? "",
    measurement_guide: chart?.measurement_guide ?? "",
    guide_media_id: chart?.guide_media_id ?? null,
  });
  const [table, setTable] = useState<SizeChartTable>(() => chart?.chart ?? { columns: ["Size", "Bust", "Waist", "Hip"], rows: [["", "", "", ""]] });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const save = useAdminMutation(
    (body: Record<string, unknown>) => (chart ? adminApi.patch(`/admin/size-charts/${chart.id}`, body) : adminApi.post("/admin/size-charts", body)),
    { success: chart ? "Size chart updated" : "Size chart created", invalidate: [SIZE_CHARTS_KEY], onSuccess: onClose },
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const columns = table.columns.map((c) => c.trim());
    save.mutate({
      name: form.name.trim(),
      slug: textOrNull(form.slug),
      unit: form.unit,
      description: textOrNull(form.description),
      measurement_guide: textOrNull(form.measurement_guide),
      guide_media_id: form.guide_media_id,
      chart: columns.length ? { columns, rows: table.rows.map((r) => columns.map((_, i) => (r[i] ?? "").trim())) } : null,
    });
  };

  const chartError = Object.entries(save.fieldErrors).find(([k]) => k.startsWith("chart"))?.[1]?.[0];

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={chart ? `Edit ${chart.name}` : "New size chart"}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} loading={save.isPending}>{chart ? "Save changes" : "Create size chart"}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-6" noValidate>
        <FormSection title="Details">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Name" required value={form.name} onChange={(v) => set({ name: v })} error={save.fieldError("name")} maxLength={150} className="sm:col-span-2" />
            <Field label="Unit" htmlFor={unitId} required error={save.fieldError("unit")}>
              <Select id={unitId} value={form.unit} onChange={(e) => set({ unit: e.target.value as "in" | "cm" })}>
                <option value="in">Inches (in)</option>
                <option value="cm">Centimetres (cm)</option>
              </Select>
            </Field>
          </div>
          <TextField label="Slug" value={form.slug} onChange={(v) => set({ slug: v.toLowerCase() })} error={save.fieldError("slug")} maxLength={150} hint="Internal identifier. Leave blank to generate from the name." inputClassName="font-mono" />
          <TextAreaField label="Description" rows={2} value={form.description} onChange={(v) => set({ description: v })} error={save.fieldError("description")} maxLength={2000} />
        </FormSection>

        <FormSection title="Measurements table">
          <ChartEditor value={table} onChange={setTable} unit={form.unit} />
          {chartError && <p className="text-xs text-red-700" role="alert">{chartError}</p>}
        </FormSection>

        <FormSection title="How to measure">
          <TextAreaField label="Measurement guide" rows={5} value={form.measurement_guide} onChange={(v) => set({ measurement_guide: v })} error={save.fieldError("measurement_guide")} maxLength={5000} hint="One instruction per line, e.g. “Bust: around the fullest part of the chest.”" />
          <Field label="Downloadable guide (PDF)" error={save.fieldError("guide_media_id")} hint="Optional printable guide offered alongside the chart.">
            <div className="space-y-1">
              <MediaField kind="document" value={form.guide_media_id} onChange={(id) => set({ guide_media_id: id })} label="Choose PDF" />
              {chart?.guide_url && form.guide_media_id === chart.guide_media_id && (
                <a href={chart.guide_url} target="_blank" rel="noopener noreferrer" className="text-xs text-royal hover:underline">Open current PDF</a>
              )}
            </div>
          </Field>
        </FormSection>
      </form>
    </Modal>
  );
}

/** Editable grid: column headers + rows of cells. Keeps every row the same width as the header. */
function ChartEditor({ value, onChange, unit }: { value: SizeChartTable; onChange: (v: SizeChartTable) => void; unit: string }) {
  const { columns, rows } = value;
  const setColumn = (i: number, text: string) => onChange({ columns: columns.map((c, j) => (j === i ? text : c)), rows });
  const setCell = (r: number, c: number, text: string) => onChange({ columns, rows: rows.map((row, i) => (i === r ? columns.map((_, j) => (j === c ? text : row[j] ?? "")) : row)) });
  const addColumn = () => onChange({ columns: [...columns, ""], rows: rows.map((row) => [...columns.map((_, j) => row[j] ?? ""), ""]) });
  const removeColumn = (i: number) => onChange({ columns: columns.filter((_, j) => j !== i), rows: rows.map((row) => row.filter((_, j) => j !== i)) });
  const addRow = () => onChange({ columns, rows: [...rows, columns.map(() => "")] });
  const removeRow = (i: number) => onChange({ columns, rows: rows.filter((_, j) => j !== i) });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col, i) => (
                <th key={i} scope="col" className="p-1.5 align-bottom">
                  <div className="flex items-center gap-1">
                    <input
                      value={col}
                      onChange={(e) => setColumn(i, e.target.value)}
                      maxLength={40}
                      aria-label={`Column ${i + 1} heading`}
                      placeholder={i === 0 ? "Size" : `Measurement (${unit})`}
                      className="h-8 w-28 rounded border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 focus:border-royal focus:outline-none"
                    />
                    <button type="button" onClick={() => removeColumn(i)} disabled={columns.length <= 1} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30" aria-label={`Remove column ${col || i + 1}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-10 p-1.5"><span className="sr-only">Row actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, r) => (
              <tr key={r}>
                {columns.map((col, c) => (
                  <td key={c} className="p-1.5">
                    <input
                      value={row[c] ?? ""}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      maxLength={40}
                      aria-label={`Row ${r + 1}, ${col || `column ${c + 1}`}`}
                      className="h-8 w-[8.25rem] rounded border border-slate-200 px-2 text-sm focus:border-royal focus:outline-none"
                    />
                  </td>
                ))}
                <td className="p-1.5 text-right">
                  <button type="button" onClick={() => removeRow(r)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-700" aria-label={`Remove row ${r + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="px-3 py-4 text-center text-xs text-slate-500">No rows yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={addRow} disabled={rows.length >= MAX_ROWS}><Plus className="h-4 w-4" /> Add row</Button>
        <Button size="sm" variant="secondary" onClick={addColumn} disabled={columns.length >= MAX_COLUMNS}><Plus className="h-4 w-4" /> Add column</Button>
        <span className="text-xs text-slate-500">{columns.length}/{MAX_COLUMNS} columns · {rows.length}/{MAX_ROWS} rows</span>
      </div>
    </div>
  );
}
