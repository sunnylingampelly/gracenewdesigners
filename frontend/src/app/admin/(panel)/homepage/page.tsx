"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, RotateCcw, Trash2, Undo2, UploadCloud } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/admin/guard";
import { Badge, Button, Card, EmptyState, ErrorNotice, Field, Input, Modal, PageHeader, Spinner, Switch, useConfirm } from "@/components/admin/ui";
import { cleanConfig, SectionConfigForm, type Config, type SectionType } from "@/components/admin/content/section-editor";
import { DragHandle, fromLocalInput, makeErrorReader, openPreview, snapshot, SortableList, toLocalInput } from "@/components/admin/content/shared";
import { adminApi, useAdminMutation, useAdminQuery, useUnsavedChangesWarning } from "@/lib/admin/hooks";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

type Section = {
  id: number;
  type: SectionType;
  type_label: string;
  name: string;
  config: Config | null;
  is_enabled: boolean;
  sort_order: number;
  is_published: boolean;
  live_is_enabled: boolean;
  pending_removal: boolean;
  has_unpublished_changes: boolean;
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
};
type TypeDef = { value: SectionType; label: string; defaults: Config | [] };
type SectionsResponse = { data: Section[]; meta: { has_unpublished_changes: boolean; last_published_at: string | null; types: TypeDef[] } };

const KEY = ["admin", "/admin/homepage/sections"];

const TYPE_DESCRIPTIONS: Record<SectionType, string> = {
  hero_image: "Full-width campaign image with headline and button.",
  hero_video: "Muted autoplay campaign video with headline.",
  split_editorial: "Editorial copy beside a large image.",
  text_image: "Text block paired with an image.",
  brand_story: "The house story, image and copy.",
  category_grid: "Up to 8 category tiles.",
  collection_feature: "Spotlight a single collection.",
  featured_products: "A rail or grid of products.",
  occasion_grid: "Shop-by-occasion tiles.",
  lookbook_gallery: "Images from a lookbook or hand-picked.",
  craftsmanship: "Craft story with up to 4 pillars.",
  testimonials: "Approved, consented client testimonials.",
  newsletter: "Email sign-up block.",
  appointment_cta: "Book a consultation / WhatsApp prompt.",
  social_gallery: "Social media image grid.",
};

export default function HomepageBuilderPage() {
  return (
    <RequirePermission permission="content.manage">
      <HomepageBuilder />
    </RequirePermission>
  );
}

type EditorState = { mode: "create"; type: SectionType; typeLabel: string; name: string; config: Config } | { mode: "edit"; section: Section };

function HomepageBuilder() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useAdminQuery<SectionsResponse>("/admin/homepage/sections");
  const [optimisticOrder, setOptimisticOrder] = useState<number[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const { confirm, dialog } = useConfirm();

  const sections = useMemo(() => {
    const list = data?.data ?? [];
    if (!optimisticOrder) return list;
    return [...list].sort((a, b) => optimisticOrder.indexOf(a.id) - optimisticOrder.indexOf(b.id));
  }, [data, optimisticOrder]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const reorder = useAdminMutation((ids: number[]) => adminApi.post("/admin/homepage/sections/reorder", { ids }), {
    success: "Order saved to draft",
    invalidate: [KEY],
  });
  const toggle = useAdminMutation(({ id, is_enabled }: { id: number; is_enabled: boolean }) => adminApi.patch(`/admin/homepage/sections/${id}`, { is_enabled }), {
    success: (r: unknown) => ((r as { data: Section }).data.is_enabled ? "Section shown (draft)" : "Section hidden (draft)"),
    invalidate: [KEY],
  });
  const restore = useAdminMutation((id: number) => adminApi.post(`/admin/homepage/sections/${id}/restore`), { success: "Section restored", invalidate: [KEY] });

  const onReorder = (next: Section[]) => {
    const ids = next.map((s) => s.id);
    setOptimisticOrder(ids);
    reorder.mutate(ids, { onSettled: () => setOptimisticOrder(null) });
  };

  const remove = (s: Section) =>
    confirm({
      title: `Remove “${s.name}”?`,
      description: s.is_published
        ? "This section is live. It will be marked for removal and disappear from the storefront when you next publish. You can restore it until then."
        : "This draft section has never been published and will be deleted permanently.",
      confirmLabel: "Remove",
      destructive: true,
      action: async () => {
        try {
          await adminApi.delete(`/admin/homepage/sections/${s.id}`);
          toast.success(s.is_published ? "Section marked for removal" : "Draft section deleted");
          await invalidate();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not remove section");
        }
      },
    });

  const publish = () =>
    confirm({
      title: "Publish homepage?",
      description: "All draft changes — content, order, visibility and removals — will go live on the storefront immediately.",
      confirmLabel: "Publish now",
      action: async () => {
        try {
          const r = await adminApi.post<{ data: { published_sections: number } }>("/admin/homepage/publish");
          toast.success(`Homepage published (${r.data.published_sections} sections)`);
          await invalidate();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Publish failed");
        }
      },
    });

  const discard = () =>
    confirm({
      title: "Discard unpublished changes?",
      description: "Every section returns to its live version. Sections that were never published are deleted. This cannot be undone.",
      confirmLabel: "Discard changes",
      destructive: true,
      action: async () => {
        try {
          await adminApi.post("/admin/homepage/discard");
          toast.success("Draft changes discarded");
          await invalidate();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not discard changes");
        }
      },
    });

  const preview = async () => {
    try {
      await openPreview(async () => (await adminApi.get<{ data: { token: string } }>("/admin/homepage/preview-token")).data.token, "/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open preview");
    }
  };

  const meta = data?.meta;

  return (
    <>
      <PageHeader
        title="Homepage Builder"
        description="Edit, reorder and schedule homepage sections. Changes are saved as a draft and only go live when you publish."
        actions={
          <>
            <Button variant="secondary" onClick={preview} disabled={!data}><Eye className="h-4 w-4" /> Preview</Button>
            <Button variant="secondary" onClick={discard} disabled={!meta?.has_unpublished_changes}><Undo2 className="h-4 w-4" /> Discard changes</Button>
            <Button onClick={publish} disabled={!meta?.has_unpublished_changes}><UploadCloud className="h-4 w-4" /> Publish</Button>
          </>
        }
      />

      {meta && (
        <div className={cn("mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border px-4 py-3 text-sm", meta.has_unpublished_changes ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900")} role="status">
          <span className="font-medium">{meta.has_unpublished_changes ? "Unpublished changes" : "Live homepage is up to date"}</span>
          <span className="text-xs opacity-80">
            {meta.last_published_at ? <>Last published {relativeTime(meta.last_published_at)} <span className="opacity-70">({formatDateTime(meta.last_published_at)})</span></> : "Never published"}
          </span>
        </div>
      )}

      <Card
        title="Sections"
        description="Drag the handle (or focus it and use Space + arrow keys) to reorder."
        actions={<Button size="sm" onClick={() => setAdding(true)} disabled={!data}><Plus className="h-4 w-4" /> Add section</Button>}
        padded={false}
      >
        {isLoading ? (
          <Spinner />
        ) : error || !data ? (
          <div className="p-5"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
        ) : sections.length === 0 ? (
          <EmptyState title="No sections yet" description="Add a hero to begin building the homepage." action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add section</Button>} />
        ) : (
          <SortableList items={sections} getId={(s) => s.id} onReorder={onReorder} className="divide-y divide-slate-100" label="Section">
            {(s, handle, index) => (
              <div className={cn("flex flex-col gap-3 bg-white px-3 py-3 sm:flex-row sm:items-center sm:px-4", s.pending_removal && "bg-red-50/40")}>
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <DragHandle handle={handle} label={`Reorder ${s.name} (position ${index + 1})`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={cn("font-medium text-slate-900", s.pending_removal && "line-through decoration-red-400")}>{s.name}</span>
                      <span className="text-xs text-slate-500">{s.type_label}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {!s.is_published && <Badge tone="blue">Draft only</Badge>}
                      {s.is_published && s.has_unpublished_changes && !s.pending_removal && <Badge tone="amber">Unpublished changes</Badge>}
                      {!s.is_enabled && <Badge tone="slate">Hidden</Badge>}
                      {(s.starts_at || s.ends_at) && <Badge tone="violet">{scheduleLabel(s)}</Badge>}
                      {s.pending_removal && <Badge tone="red">Pending removal</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-0">
                  {s.pending_removal ? (
                    <Button size="sm" variant="secondary" loading={restore.isPending && restore.variables === s.id} onClick={() => restore.mutate(s.id)}><RotateCcw className="h-3.5 w-3.5" /> Restore</Button>
                  ) : (
                    <>
                      <div className="w-28">
                        <Switch checked={s.is_enabled} onCheckedChange={(v) => toggle.mutate({ id: s.id, is_enabled: v })} label={<span className="text-xs">{s.is_enabled ? "Shown" : "Hidden"}</span>} disabled={toggle.isPending && toggle.variables?.id === s.id} />
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setEditor({ mode: "edit", section: s })} aria-label={`Edit ${s.name}`}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(s)} aria-label={`Remove ${s.name}`}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </SortableList>
        )}
      </Card>

      {data && (
        <AddSectionDialog
          open={adding}
          onOpenChange={setAdding}
          types={data.meta.types}
          onContinue={(type, name) => {
            const def = data.meta.types.find((t) => t.value === type)!;
            setAdding(false);
            setEditor({ mode: "create", type, typeLabel: def.label, name, config: Array.isArray(def.defaults) ? {} : { ...def.defaults } });
          }}
        />
      )}

      {editor && <SectionEditorDialog key={editor.mode === "edit" ? `e${editor.section.id}` : `c${editor.type}`} state={editor} onClose={() => setEditor(null)} />}
      {dialog}
    </>
  );
}

function scheduleLabel(s: Section): string {
  const fmt = (v: string) => new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (s.starts_at && s.ends_at) return `Scheduled ${fmt(s.starts_at)} – ${fmt(s.ends_at)}`;
  if (s.starts_at) return `From ${fmt(s.starts_at)}`;
  return `Until ${fmt(s.ends_at!)}`;
}

function AddSectionDialog({ open, onOpenChange, types, onContinue }: { open: boolean; onOpenChange: (o: boolean) => void; types: TypeDef[]; onContinue: (type: SectionType, name: string) => void }) {
  const [type, setType] = useState<SectionType | null>(null);
  const [name, setName] = useState("");
  const nameId = useId();
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setType(null);
      setName("");
    }
  };
  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Add section"
      description="Choose a section type and give it an internal name. You’ll configure it next."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
          <Button disabled={!type || !name.trim()} onClick={() => { onContinue(type!, name.trim()); setType(null); setName(""); }}>Continue</Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-800">Section type</legend>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
            {types.map((t) => (
              <label key={t.value} className={cn("flex cursor-pointer gap-3 rounded-md border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-royal", type === t.value ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300")}>
                <input
                  type="radio"
                  name="section-type"
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => {
                    setType(t.value);
                    if (!name.trim()) setName(t.label);
                  }}
                  className="mt-0.5 h-4 w-4 accent-slate-900"
                />
                <span>
                  <span className="block font-medium text-slate-900">{t.label}</span>
                  <span className="block text-xs text-slate-500">{TYPE_DESCRIPTIONS[t.value]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Internal name" htmlFor={nameId} required hint="Only staff see this name.">
          <Input id={nameId} value={name} maxLength={150} onChange={(e) => setName(e.target.value)} placeholder="e.g. Festive hero" />
        </Field>
      </div>
    </Modal>
  );
}

function SectionEditorDialog({ state, onClose }: { state: EditorState; onClose: () => void }) {
  const type = state.mode === "edit" ? state.section.type : state.type;
  const typeLabel = state.mode === "edit" ? state.section.type_label : state.typeLabel;
  const initial = useMemo(
    () =>
      state.mode === "edit"
        ? { name: state.section.name, config: { ...(state.section.config ?? {}) } as Config, starts_at: toLocalInput(state.section.starts_at), ends_at: toLocalInput(state.section.ends_at) }
        : { name: state.name, config: state.config, starts_at: "", ends_at: "" },
    [state],
  );
  const [form, setForm] = useState(initial);
  const dirty = snapshot(form) !== snapshot(initial);
  useUnsavedChangesWarning(dirty);
  const { confirm, dialog } = useConfirm();
  const nameId = useId();
  const startId = useId();
  const endId = useId();

  const save = useAdminMutation(
    () => {
      const body = { name: form.name, config: cleanConfig(type, form.config), starts_at: fromLocalInput(form.starts_at), ends_at: fromLocalInput(form.ends_at) };
      return state.mode === "edit" ? adminApi.patch(`/admin/homepage/sections/${state.section.id}`, body) : adminApi.post("/admin/homepage/sections", { type, ...body });
    },
    { success: state.mode === "edit" ? "Section saved to draft" : "Section added to draft", invalidate: [KEY], onSuccess: onClose },
  );
  const error = makeErrorReader(save.fieldErrors, "config");
  const errorCount = Object.keys(save.fieldErrors).length;

  const requestClose = () => {
    if (!dirty) return onClose();
    confirm({ title: "Discard unsaved edits?", description: "Your changes to this section haven’t been saved.", confirmLabel: "Discard", destructive: true, action: onClose });
  };

  return (
    <>
      <Modal
        open
        onOpenChange={(o) => !o && requestClose()}
        title={state.mode === "edit" ? `Edit “${state.section.name}”` : `New ${typeLabel} section`}
        description={`${typeLabel} · Saved changes stay in draft until you publish the homepage.`}
        size="lg"
        footer={
          <>
            {errorCount > 0 && <span className="mr-auto self-center text-xs text-red-700" role="alert">Please fix {errorCount} highlighted field{errorCount > 1 ? "s" : ""}.</span>}
            <Button variant="secondary" onClick={requestClose}>Cancel</Button>
            <Button loading={save.isPending} onClick={() => save.mutate(undefined)} disabled={!form.name.trim()}>{state.mode === "edit" ? "Save draft" : "Add section"}</Button>
          </>
        }
      >
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
          <Field label="Internal name" htmlFor={nameId} required error={save.fieldError("name")}>
            <Input id={nameId} value={form.name} maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!save.fieldError("name")} />
          </Field>
          <SectionConfigForm type={type} config={form.config} onChange={(config) => setForm({ ...form, config })} error={error} />
          <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Schedule</legend>
            <p className="text-xs text-slate-500">Optional. The section only appears between these times. Schedule changes take effect immediately for published sections.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Show from" htmlFor={startId} error={save.fieldError("starts_at")}>
                <Input id={startId} type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </Field>
              <Field label="Show until" htmlFor={endId} error={save.fieldError("ends_at")}>
                <Input id={endId} type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </Field>
            </div>
          </fieldset>
          <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
        </form>
      </Modal>
      {dialog}
    </>
  );
}

