"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Badge, Button, Card, type Column, DataTable, EmptyState, ErrorNotice, Field, Input, Modal, Spinner, Switch } from "@/components/admin/ui";
import { adminApi, useAdminMutation, useAdminQuery } from "@/lib/admin/hooks";
import { slugify, textOrNull, toInt } from "./form-utils";
import { TextField, useDeleteConfirm } from "./shared";
import type { OptionValue, ProductOption } from "./types";

const OPTIONS_KEY = ["admin", "/admin/options"];
const HEX = /^#[0-9A-Fa-f]{6}$/;

export function OptionsTab() {
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: ProductOption[] }>("/admin/options");
  const [editing, setEditing] = useState<{ option: ProductOption; value: OptionValue | null } | null>(null);
  const { confirmDelete, dialog } = useDeleteConfirm();

  if (isLoading) return <Spinner label="Loading sizes and colours" />;
  if (error || !data) return <ErrorNotice error={error} onRetry={() => refetch()} />;
  if (!data.data.length) return <Card><EmptyState title="No variant options configured" description="Size and colour option dictionaries are created by the platform setup." /></Card>;

  return (
    <div className="space-y-6">
      {data.data.map((option) => {
        const isColour = option.code === "color";
        const noun = isColour ? "colour" : option.code === "size" ? "size" : "value";
        const columns: Column<OptionValue>[] = [
          {
            key: "label",
            header: "Label",
            cell: (v) => (
              <div className="flex items-center gap-3">
                {isColour && <span className="h-6 w-6 shrink-0 rounded-full border border-slate-300 shadow-inner" style={{ backgroundColor: v.hex ?? "transparent" }} aria-hidden />}
                <span className="font-medium text-slate-900">{v.label}</span>
              </div>
            ),
          },
          { key: "code", header: "Code", cell: (v) => <span className="font-mono text-xs text-slate-600">{v.code}</span> },
          ...(isColour
            ? [{ key: "hex", header: "Hex", cell: (v: OptionValue) => <span className="font-mono text-xs uppercase text-slate-600">{v.hex ?? "—"}</span> } satisfies Column<OptionValue>]
            : [
                { key: "group", header: "Size group", cell: (v: OptionValue) => <span className="text-slate-600">{v.size_group ?? "—"}</span> } satisfies Column<OptionValue>,
                { key: "custom", header: "Type", cell: (v: OptionValue) => (v.is_custom ? <Badge tone="violet">Made to measure</Badge> : <Badge>Standard</Badge>) } satisfies Column<OptionValue>,
              ]),
          { key: "sort", header: "Order", cell: (v) => <span className="tabular-nums text-slate-500">{v.sort_order}</span>, hideOnMobile: true },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "text-right",
            cell: (v) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ option, value: v })} aria-label={`Edit ${v.label}`}><Pencil className="h-4 w-4" /></Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${v.label}`}
                  onClick={() => confirmDelete({
                    title: `Delete ${noun} “${v.label}”?`,
                    description: `It will no longer be available for new variants. Values already used by product variants cannot be deleted.`,
                    path: `/admin/options/${option.id}/values/${v.id}`,
                    invalidate: [OPTIONS_KEY],
                    success: `${noun[0].toUpperCase() + noun.slice(1)} deleted`,
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
            key={option.id}
            title={isColour ? "Colours" : option.code === "size" ? "Sizes" : option.name}
            description={isColour ? "Colour swatches shown on products and used as shop filters." : "Sizes offered on product variants. Mark made-to-measure entries as custom."}
            padded={false}
            actions={<Button size="sm" onClick={() => setEditing({ option, value: null })}><Plus className="h-4 w-4" /> Add {noun}</Button>}
          >
            <DataTable columns={columns} rows={option.values} rowKey={(v) => v.id} empty={<EmptyState title={`No ${noun}s yet`} />} />
          </Card>
        );
      })}
      {editing && <OptionValueModal key={`${editing.option.id}-${editing.value?.id ?? "new"}`} option={editing.option} value={editing.value} onClose={() => setEditing(null)} />}
      {dialog}
    </div>
  );
}

function OptionValueModal({ option, value, onClose }: { option: ProductOption; value: OptionValue | null; onClose: () => void }) {
  const formId = useId();
  const hexId = useId();
  const isColour = option.code === "color";
  const noun = isColour ? "colour" : option.code === "size" ? "size" : "value";
  const [form, setForm] = useState({
    label: value?.label ?? "",
    code: value?.code ?? "",
    hex: value?.hex ?? (isColour ? "#000000" : ""),
    size_group: value?.size_group ?? "",
    is_custom: value?.is_custom ?? false,
    sort_order: String(value?.sort_order ?? option.values.length),
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useAdminMutation(
    (body: Record<string, unknown>) => (value ? adminApi.patch(`/admin/options/${option.id}/values/${value.id}`, body) : adminApi.post(`/admin/options/${option.id}/values`, body)),
    { success: value ? `${value.label} updated` : `${noun[0].toUpperCase() + noun.slice(1)} added`, invalidate: [OPTIONS_KEY], onSuccess: onClose },
  );
  const hexValid = HEX.test(form.hex);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      label: form.label.trim(),
      code: textOrNull(form.code),
      sort_order: toInt(form.sort_order),
      ...(isColour ? { hex: form.hex.trim() } : { size_group: textOrNull(form.size_group), is_custom: form.is_custom }),
    });
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={value ? `Edit ${value.label}` : `Add ${noun}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} loading={save.isPending} disabled={isColour && !hexValid}>{value ? "Save changes" : `Add ${noun}`}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Label" required value={form.label} onChange={(v) => set({ label: v })} error={save.fieldError("label")} maxLength={80} placeholder={isColour ? "Midnight Blue" : "M"} />
        <TextField
          label="Code"
          value={form.code}
          onChange={(v) => set({ code: v.toLowerCase() })}
          error={save.fieldError("code")}
          placeholder={slugify(form.label)}
          maxLength={80}
          inputClassName="font-mono"
          hint="Lowercase letters, numbers and hyphens; used in filter URLs. Leave blank to generate from the label."
        />
        {isColour ? (
          <Field label="Swatch colour" htmlFor={hexId} required error={save.fieldError("hex") ?? (!hexValid ? "Enter a hex colour like #1E3A8A." : undefined)}>
            <div className="flex items-center gap-2">
              <input type="color" value={hexValid ? form.hex : "#000000"} onChange={(e) => set({ hex: e.target.value.toUpperCase() })} aria-label="Pick swatch colour" className="h-10 w-14 cursor-pointer rounded-md border border-slate-300 bg-white p-1" />
              <Input id={hexId} value={form.hex} onChange={(e) => set({ hex: e.target.value })} invalid={!hexValid || !!save.fieldError("hex")} placeholder="#RRGGBB" maxLength={7} className="w-32 font-mono uppercase" />
            </div>
          </Field>
        ) : (
          <>
            <TextField label="Size group" value={form.size_group} onChange={(v) => set({ size_group: v })} error={save.fieldError("size_group")} maxLength={60} placeholder="Alpha, Numeric, Kids…" hint="Groups sizes together in filters and pickers." />
            <Switch label="Custom / made to measure" description="Customers provide their own measurements for this size." checked={form.is_custom} onCheckedChange={(v) => set({ is_custom: v })} />
          </>
        )}
        <TextField label="Sort order" type="number" value={form.sort_order} onChange={(v) => set({ sort_order: v })} error={save.fieldError("sort_order")} />
      </form>
    </Modal>
  );
}
