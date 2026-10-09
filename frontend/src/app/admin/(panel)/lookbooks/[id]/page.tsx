"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails come straight from backend renditions */
import { ImagePlus, Trash2, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/admin/guard";
import { MediaPickerDialog } from "@/components/admin/media-picker";
import { Button, Card, EmptyState, ErrorNotice, Field, Input, PageHeader, Select, Spinner, Textarea, useConfirm } from "@/components/admin/ui";
import { ChoiceGroup, DragHandle, fromLocalInput, LookupSelect, MediaIdField, ProductLabel, ProductSearch, snapshot, SortableList, toLocalInput, uid } from "@/components/admin/content/shared";
import { adminApi, useAdminMutation, useAdminQuery, useUnsavedChangesWarning } from "@/lib/admin/hooks";

type Layout = "portrait" | "landscape" | "full";
type ApiItem = { id: number; media_asset_id: number; caption: string | null; product_id: number | null; collection_id: number | null; layout: Layout; thumb_url: string | null };
type Lookbook = {
  id: number; title: string; slug: string; season: string | null; description: string | null; cover_media_id: number | null; collection_id: number | null;
  status: "draft" | "published"; sort_order: number; seo_title: string | null; seo_description: string | null; published_at: string | null; cover_url: string | null; items: ApiItem[];
};
type Item = { key: string; media_asset_id: number; thumb_url: string | null; caption: string; link: "none" | "product" | "collection"; product_id: number | null; collection_id: number | null; layout: Layout };

export default function LookbookEditorPage() {
  return (
    <RequirePermission permission="content.manage">
      <LookbookLoader />
    </RequirePermission>
  );
}

function LookbookLoader() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: Lookbook }>(`/admin/lookbooks/${id}`);
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNotice error={error} onRetry={() => refetch()} />;
  return <LookbookEditor key={data.data.id} lookbook={data.data} />;
}

function toForm(l: Lookbook) {
  return {
    title: l.title,
    slug: l.slug,
    season: l.season ?? "",
    description: l.description ?? "",
    cover_media_id: l.cover_media_id,
    collection_id: l.collection_id,
    status: l.status,
    published_at: toLocalInput(l.published_at),
    sort_order: l.sort_order ?? 0,
    seo_title: l.seo_title ?? "",
    seo_description: l.seo_description ?? "",
    items: l.items.map<Item>((i) => ({
      key: `i${i.id}`,
      media_asset_id: i.media_asset_id,
      thumb_url: i.thumb_url,
      caption: i.caption ?? "",
      link: i.product_id ? "product" : i.collection_id ? "collection" : "none",
      product_id: i.product_id,
      collection_id: i.collection_id,
      layout: i.layout ?? "portrait",
    })),
  };
}
type Form = ReturnType<typeof toForm>;
/** Dirty-check representation (ignores client-only keys). */
const comparable = (f: Form) => snapshot({ ...f, items: f.items.map((i) => [i.media_asset_id, i.caption, i.link, i.product_id, i.collection_id, i.layout]) });

function LookbookEditor({ lookbook }: { lookbook: Lookbook }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(lookbook));
  const [saved, setSaved] = useState(() => comparable(toForm(lookbook)));
  const [picking, setPicking] = useState(false);
  const dirty = comparable(form) !== saved;
  useUnsavedChangesWarning(dirty);
  const { confirm, dialog } = useConfirm();
  const ids = { title: useId(), slug: useId(), season: useId(), desc: useId(), coll: useId(), status: useId(), pub: useId(), sort: useId(), seoT: useId(), seoD: useId() };
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setItem = (key: string, patch: Partial<Item>) => setForm((f) => ({ ...f, items: f.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));

  const save = useAdminMutation(
    () =>
      adminApi.patch<{ data: Lookbook }>(`/admin/lookbooks/${lookbook.id}`, {
        title: form.title,
        slug: form.slug || null,
        season: form.season || null,
        description: form.description || null,
        cover_media_id: form.cover_media_id,
        collection_id: form.collection_id,
        status: form.status,
        published_at: fromLocalInput(form.published_at),
        sort_order: Number(form.sort_order) || 0,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        items: form.items.map((i) => ({
          media_asset_id: i.media_asset_id,
          caption: i.caption || null,
          product_id: i.link === "product" ? i.product_id : null,
          collection_id: i.link === "collection" ? i.collection_id : null,
          layout: i.layout,
        })),
      }),
    {
      success: "Lookbook saved",
      invalidate: [["admin", "/admin/lookbooks"]],
      onSuccess: (r) => {
        const next = toForm(r.data);
        setForm(next);
        setSaved(comparable(next));
      },
    },
  );
  const fe = save.fieldError;
  const itemError = (index: number) => ["media_asset_id", "caption", "product_id", "collection_id", "layout"].map((k) => fe(`items.${index}.${k}`)).find(Boolean);

  const remove = () =>
    confirm({
      title: `Delete “${lookbook.title}”?`,
      description: "The lookbook and its image layout will be removed. Media files stay in the library.",
      confirmLabel: "Delete lookbook",
      destructive: true,
      action: async () => {
        try {
          await adminApi.delete(`/admin/lookbooks/${lookbook.id}`);
          toast.success("Lookbook deleted");
          setSaved(comparable(form));
          router.push("/admin/lookbooks");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not delete lookbook");
        }
      },
    });

  return (
    <>
      <PageHeader
        title={form.title || "Untitled lookbook"}
        breadcrumbs={[{ label: "Lookbook", href: "/admin/lookbooks" }, { label: lookbook.title }]}
        description={dirty ? "You have unsaved changes." : `/lookbook/${lookbook.slug}`}
        actions={
          <>
            <Button variant="ghost" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>
            {lookbook.status === "published" && <a href={`/lookbook/${lookbook.slug}`} target="_blank" rel="noreferrer" className="text-sm text-royal hover:underline">View live</a>}
            <Button loading={save.isPending} disabled={!dirty || !form.title.trim()} onClick={() => save.mutate(undefined)}>Save changes</Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor={ids.title} required error={fe("title")} className="sm:col-span-2">
                <Input id={ids.title} value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} invalid={!!fe("title")} />
              </Field>
              <Field label="Slug" htmlFor={ids.slug} error={fe("slug")} hint="Lowercase letters, numbers and hyphens.">
                <Input id={ids.slug} value={form.slug} maxLength={200} onChange={(e) => set("slug", e.target.value)} invalid={!!fe("slug")} />
              </Field>
              <Field label="Season" htmlFor={ids.season} error={fe("season")}>
                <Input id={ids.season} value={form.season} maxLength={80} onChange={(e) => set("season", e.target.value)} />
              </Field>
              <Field label="Description" htmlFor={ids.desc} error={fe("description")} className="sm:col-span-2" hint={`${form.description.length}/3000`}>
                <Textarea id={ids.desc} rows={4} value={form.description} maxLength={3000} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label="Cover image" error={fe("cover_media_id")}>
                <MediaIdField value={form.cover_media_id} preview={form.cover_media_id === lookbook.cover_media_id ? lookbook.cover_url : null} onChange={(v) => set("cover_media_id", v)} />
              </Field>
              <Field label="Linked collection" htmlFor={ids.coll} error={fe("collection_id")}>
                <LookupSelect id={ids.coll} kind="collections" value={form.collection_id} onChange={(v) => set("collection_id", v)} placeholder="— None —" />
              </Field>
            </div>
          </Card>

          <Card
            title={`Images (${form.items.length})`}
            description="Drag to reorder (keyboard: focus the handle, Space, arrow keys, Space). Up to 60 images."
            actions={<Button size="sm" variant="secondary" disabled={form.items.length >= 60} onClick={() => setPicking(true)}><ImagePlus className="h-4 w-4" /> Add images</Button>}
          >
            {fe("items") && <p className="mb-3 text-xs text-red-700" role="alert">{fe("items")}</p>}
            {form.items.length === 0 ? (
              <EmptyState title="No images yet" description="Add images from the media library to build this lookbook." action={<Button variant="secondary" onClick={() => setPicking(true)}><ImagePlus className="h-4 w-4" /> Add images</Button>} />
            ) : (
              <SortableList items={form.items} getId={(i) => i.key} onReorder={(items) => set("items", items)} className="space-y-3" label="Image">
                {(item, handle, index) => (
                  <div className="flex gap-3 rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex flex-col items-center gap-2">
                      <DragHandle handle={handle} label={`Reorder image ${index + 1}`} />
                      <span className="text-xs text-slate-400 tabular-nums">{index + 1}</span>
                    </div>
                    {item.thumb_url ? <img src={item.thumb_url} alt="" className="h-28 w-20 shrink-0 rounded object-cover" /> : <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">#{item.media_asset_id}</div>}
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                      <Labeled label="Caption" className="sm:col-span-2">
                        {(id) => <Input id={id} value={item.caption} maxLength={255} onChange={(e) => setItem(item.key, { caption: e.target.value })} />}
                      </Labeled>
                      <div className="space-y-1.5">
                        <span className="block text-sm font-medium text-slate-800">Layout</span>
                        <ChoiceGroup label={`Layout for image ${index + 1}`} value={item.layout} onChange={(v) => setItem(item.key, { layout: v ?? "portrait" })} options={[{ value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }, { value: "full", label: "Full width" }]} />
                      </div>
                      <Labeled label="Links to">
                        {(id) => (
                          <Select id={id} value={item.link} onChange={(e) => setItem(item.key, { link: e.target.value as Item["link"] })}>
                            <option value="none">Nothing</option>
                            <option value="product">A product</option>
                            <option value="collection">A collection</option>
                          </Select>
                        )}
                      </Labeled>
                      {item.link === "product" && (
                        <div className="space-y-1.5 sm:col-span-2">
                          <span className="block text-sm font-medium text-slate-800">Product</span>
                          {item.product_id ? (
                            <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                              <ProductLabel id={item.product_id} />
                              <Button size="sm" variant="ghost" onClick={() => setItem(item.key, { product_id: null })}><X className="h-3.5 w-3.5" /> Change</Button>
                            </div>
                          ) : (
                            <ProductSearch onPick={(p) => setItem(item.key, { product_id: p.id })} />
                          )}
                        </div>
                      )}
                      {item.link === "collection" && (
                        <Labeled label="Collection" className="sm:col-span-2">
                          {(id) => <LookupSelect id={id} kind="collections" value={item.collection_id} onChange={(v) => setItem(item.key, { collection_id: v })} />}
                        </Labeled>
                      )}
                      {itemError(index) && <p className="text-xs text-red-700 sm:col-span-2" role="alert">{itemError(index)}</p>}
                    </div>
                    <Button size="sm" variant="ghost" aria-label={`Remove image ${index + 1}`} onClick={() => set("items", form.items.filter((i) => i.key !== item.key))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </SortableList>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Publishing">
            <div className="space-y-4">
              <Field label="Status" htmlFor={ids.status} error={fe("status")}>
                <Select id={ids.status} value={form.status} onChange={(e) => set("status", e.target.value as Form["status"])}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </Select>
              </Field>
              <Field label="Publish date" htmlFor={ids.pub} error={fe("published_at")} hint="Set automatically when first published. A future date schedules it.">
                <Input id={ids.pub} type="datetime-local" value={form.published_at} onChange={(e) => set("published_at", e.target.value)} />
              </Field>
              <Field label="Sort order" htmlFor={ids.sort} error={fe("sort_order")} hint="Lower numbers appear first.">
                <Input id={ids.sort} type="number" min={0} value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} className="max-w-32" />
              </Field>
            </div>
          </Card>
          <Card title="Search engine listing">
            <div className="space-y-4">
              <Field label="SEO title" htmlFor={ids.seoT} error={fe("seo_title")} hint={`${form.seo_title.length}/255 · Defaults to the title.`}>
                <Input id={ids.seoT} value={form.seo_title} maxLength={255} onChange={(e) => set("seo_title", e.target.value)} />
              </Field>
              <Field label="SEO description" htmlFor={ids.seoD} error={fe("seo_description")} hint={`${form.seo_description.length}/500`}>
                <Textarea id={ids.seoD} rows={3} value={form.seo_description} maxLength={500} onChange={(e) => set("seo_description", e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <MediaPickerDialog
        open={picking}
        onOpenChange={setPicking}
        multiple
        onSelect={(media) =>
          set("items", [
            ...form.items,
            ...media.slice(0, 60 - form.items.length).map<Item>((m) => ({ key: uid("n"), media_asset_id: m.id, thumb_url: m.thumb_url ?? m.url, caption: "", link: "none", product_id: null, collection_id: null, layout: "portrait" })),
          ])
        }
      />
      {dialog}
    </>
  );
}

function Labeled({ label, children, className }: { label: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} className={className}>
      {children(id)}
    </Field>
  );
}
