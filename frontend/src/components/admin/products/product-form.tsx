"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Archive, Copy, ExternalLink, Eye, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { MediaField } from "@/components/admin/media-picker";
import { Badge, Button, Card, Field, Input, Modal, MultiCheck, Select, StatusBadge, Switch, TagInput, Textarea, useConfirm } from "@/components/admin/ui";
import { adminApi, useUnsavedChangesWarning } from "@/lib/admin/hooks";
import { useAuth } from "@/lib/admin/auth";
import { ApiRequestError } from "@/lib/api-client";
import { cn, formatDateTime } from "@/lib/utils";
import { HtmlEditor } from "./html-editor";
import { useCatalogLookups } from "./lookups";
import { MediaSection } from "./media-section";
import { ProductPicker } from "./product-picker";
import { emptyProduct, toFormValues, toPayload, type AdminProduct, type ProductFormValues } from "./types";
import { VariantsSection } from "./variants-section";

const money = z.string().regex(/^(\d+(\.\d{1,2})?)?$/, "Enter a number, e.g. 24999 or 24999.50");

const schema = z
  .object({
    name: z.string().trim().min(2, "Give the product a name.").max(200),
    slug: z.string().regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Lowercase letters, numbers and hyphens only."),
    sku: z.string().trim().min(2, "A SKU is required.").max(64).regex(/^[A-Za-z0-9\-_]+$/, "Letters, numbers, hyphens and underscores only."),
    price: money,
    compare_at_price: money,
    cost_price: money,
    seo_title: z.string().max(255),
    seo_description: z.string().max(500),
    short_description: z.string().max(600),
  })
  .passthrough()
  .superRefine((v, ctx) => {
    const variants = (v as unknown as ProductFormValues).variants;
    if (v.price_mode === "fixed" && !v.price && !(variants.length && variants.every((row) => row.price))) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "A fixed-price product needs a price (or prices on every variant)." });
    }
    if (v.compare_at_price && v.price && Number(v.compare_at_price) <= Number(v.price)) {
      ctx.addIssue({ code: "custom", path: ["compare_at_price"], message: "Compare-at price should be higher than the selling price." });
    }
  });

const SECTIONS = [
  ["basics", "Basics"], ["media", "Images & video"], ["pricing", "Pricing"], ["variants", "Sizes & colours"],
  ["classification", "Categories & collections"], ["attributes", "Attributes"], ["details", "Details & delivery"],
  ["relations", "Related products"], ["seo", "SEO"], ["internal", "Internal notes"],
] as const;

export function ProductForm({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const lookups = useCatalogLookups();
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState<null | "draft" | "publish" | "schedule">(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const { confirm, dialog } = useConfirm();
  const [createdId, setCreatedId] = useState<number | null>(null);
  const productId = product?.id ?? createdId;
  const isNew = productId === null;

  const defaults = useMemo(() => (product ? toFormValues(product) : emptyProduct()), [product]);
  const form = useForm<ProductFormValues>({ defaultValues: defaults, resolver: zodResolver(schema) as never, mode: "onBlur" });
  const { register, control, handleSubmit, watch, setValue, reset, formState } = form;
  useEffect(() => reset(defaults), [defaults, reset]);
  useUnsavedChangesWarning(formState.isDirty && !saving);

  const values = watch();
  const err = (name: string): string | undefined => serverErrors[name]?.[0] ?? (formState.errors[name as keyof ProductFormValues]?.message as string | undefined);
  const canEdit = can("products.manage");
  const canPublish = can("products.publish");

  // Auto-suggest slug from the name for new products until the slug is edited manually.
  const [slugTouched, setSlugTouched] = useState(!isNew);
  useEffect(() => {
    if (!slugTouched) setValue("slug", values.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 190));
  }, [values.name, slugTouched, setValue]);

  const categoryOptions = useMemo(() => {
    const deptName = new Map(lookups.departments.map((d) => [d.id, d.name]));
    return lookups.categories.map((c) => ({ value: c.id, label: c.name, hint: c.depth === 0 ? deptName.get(c.department_id) : undefined, depth: c.depth }));
  }, [lookups.categories, lookups.departments]);

  const relevantAttributes = useMemo(() => {
    const selected = new Set(values.category_ids);
    return [...lookups.attributes].sort((a, b) => Number(b.category_ids.some((id) => selected.has(id))) - Number(a.category_ids.some((id) => selected.has(id))));
  }, [lookups.attributes, values.category_ids]);

  const save = async (data: ProductFormValues, intent: "draft" | "publish" | "schedule", publishAt?: string) => {
    setSaving(intent);
    setServerErrors({});
    try {
      const payload = toPayload(data);
      let saved: AdminProduct;
      if (isNew) {
        saved = (await adminApi.post<{ data: AdminProduct }>("/admin/products", { ...payload, status: "draft" })).data;
        setCreatedId(saved.id);
        // Update the address without remounting the form (keeps any validation messages visible).
        window.history.replaceState(null, "", `/admin/products/${saved.id}`);
      } else {
        saved = (await adminApi.patch<{ data: AdminProduct }>(`/admin/products/${productId}`, payload)).data;
      }
      if (intent !== "draft") {
        saved = (await adminApi.post<{ data: AdminProduct }>(`/admin/products/${saved.id}/status`, intent === "publish" ? { status: "published" } : { status: "scheduled", published_at: publishAt })).data;
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "/admin/products"] });
      queryClient.setQueryData(["admin", `/admin/products/${saved.id}`, {}], { data: saved });
      reset(toFormValues(saved));
      toast.success(intent === "publish" ? "Product published" : intent === "schedule" ? "Publishing scheduled" : "Saved");
      if (!product) router.replace(`/admin/products/${saved.id}`);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setServerErrors(error.errors);
        toast.error(error.status === 422 ? "Please fix the highlighted fields." : error.message);
        await queryClient.invalidateQueries({ queryKey: ["admin", "/admin/products"] });
      } else toast.error("Could not save the product.");
    } finally {
      setSaving(null);
    }
  };

  const statusAction = async (status: "draft" | "archived") => {
    if (!product) return;
    try {
      const saved = (await adminApi.post<{ data: AdminProduct }>(`/admin/products/${product.id}/status`, { status })).data;
      queryClient.setQueryData(["admin", `/admin/products/${product.id}`, {}], { data: saved });
      await queryClient.invalidateQueries({ queryKey: ["admin", "/admin/products"] });
      toast.success(status === "archived" ? "Product archived — it now shows as no longer available" : "Moved back to draft");
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Action failed");
    }
  };

  const preview = async () => {
    if (!product) return;
    const { data } = await adminApi.get<{ data: { token: string; path: string } }>(`/admin/products/${product.id}/preview-token`);
    window.open(`/api/preview?token=${encodeURIComponent(data.token)}&path=${encodeURIComponent(data.path)}`, "_blank", "noopener");
  };

  const duplicate = async () => {
    if (!product) return;
    const { data } = await adminApi.post<{ data: AdminProduct }>(`/admin/products/${product.id}/duplicate`);
    await queryClient.invalidateQueries({ queryKey: ["admin", "/admin/products"] });
    toast.success("Duplicated as a draft");
    router.push(`/admin/products/${data.id}`);
  };

  const errorList = Object.entries(serverErrors).slice(0, 8);
  const seoTitle = values.seo_title || values.name;

  return (
    <form onSubmit={handleSubmit((d) => save(d, "draft"))} noValidate className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-6">
        <nav aria-label="Form sections" className="scrollbar-none sticky top-14 z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded px-2.5 py-1 text-xs whitespace-nowrap text-slate-600 hover:bg-white hover:text-slate-900">{label}</a>)}
        </nav>

        {errorList.length > 0 && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" /> Some details need attention</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-6">{errorList.map(([k, m]) => <li key={k}>{m[0]}</li>)}</ul>
          </div>
        )}

        <fieldset disabled={!canEdit} className="min-w-0 space-y-6">
          <Card title="Basics" className="scroll-mt-28" padded>
            <div id="basics" className="grid gap-4 md:grid-cols-2">
              <Field label="Product name" required htmlFor="name" error={err("name")} className="md:col-span-2">
                <Input id="name" {...register("name")} invalid={!!err("name")} />
              </Field>
              <Field label="URL slug" htmlFor="slug" error={err("slug")} hint={`/products/${values.slug || "…"}${!isNew && product?.is_live ? " · changing it creates a 301 redirect" : ""}`}>
                <Input id="slug" {...register("slug", { onChange: () => setSlugTouched(true) })} invalid={!!err("slug")} />
              </Field>
              <Field label="SKU / design reference" required htmlFor="sku" error={err("sku")}>
                <Input id="sku" {...register("sku", { setValueAs: (v: string) => v.toUpperCase() })} className="font-mono uppercase" invalid={!!err("sku")} />
              </Field>
              <Field label="Department" htmlFor="department">
                <Controller control={control} name="department_id" render={({ field }) => (
                  <Select id="department" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">— Set from primary category —</option>
                    {lookups.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                )} />
              </Field>
              <Field label="Brand" htmlFor="brand"><Input id="brand" {...register("brand")} /></Field>
              <Field label="Short description" htmlFor="short" error={err("short_description")} hint="Shown near the price and in search results (max 600 characters)." className="md:col-span-2">
                <Textarea id="short" rows={3} maxLength={600} {...register("short_description")} />
              </Field>
              <Field label="Description" htmlFor="description" error={err("description")} className="md:col-span-2">
                <Controller control={control} name="description" render={({ field }) => <HtmlEditor id="description" value={field.value} onChange={field.onChange} />} />
              </Field>
            </div>
          </Card>

          <Card title="Images & video" description="Primary image, alternate angles, fabric close-ups and optional video.">
            <div id="media" className="scroll-mt-28">
              <Controller control={control} name="media" render={({ field }) => <MediaSection value={field.value} onChange={field.onChange} colors={lookups.colors} error={err("media")} />} />
            </div>
          </Card>

          <Card title="Pricing">
            <div id="pricing" className="grid scroll-mt-28 gap-4 md:grid-cols-3">
              <fieldset className="md:col-span-3">
                <legend className="mb-2 text-sm font-medium text-slate-800">Price mode</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([["fixed", "Fixed price", "Order on WhatsApp"], ["starting_from", "Starting from", "Enquire on WhatsApp"], ["on_request", "Price on request", "Request Price on WhatsApp"]] as const).map(([value, label, cta]) => (
                    <label key={value} className={cn("cursor-pointer rounded-md border p-3 text-sm", values.price_mode === value ? "border-slate-900 bg-slate-50" : "border-slate-200")}>
                      <input type="radio" value={value} {...register("price_mode")} className="sr-only" />
                      <span className="font-medium">{label}</span>
                      <span className="block text-xs text-slate-500">Button: “{cta}”</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {values.price_mode !== "on_request" ? (
                <>
                  <Field label={values.price_mode === "starting_from" ? "Starting price (INR)" : "Selling price (INR)"} htmlFor="price" error={err("price")} required={values.price_mode === "fixed"}>
                    <Input id="price" inputMode="decimal" {...register("price")} invalid={!!err("price")} />
                  </Field>
                  {values.price_mode === "fixed" && (
                    <Field label="Compare-at price" htmlFor="compare" error={err("compare_at_price")} hint="Optional, shown struck through.">
                      <Input id="compare" inputMode="decimal" {...register("compare_at_price")} />
                    </Field>
                  )}
                </>
              ) : (
                <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600 md:col-span-2">No price is shown publicly or included in structured data. The team shares pricing on WhatsApp.</p>
              )}
              <Field label="Internal cost (never public)" htmlFor="cost" error={err("cost_price")}>
                <Input id="cost" inputMode="decimal" {...register("cost_price")} />
              </Field>
              <Field label="Tax note" htmlFor="tax" hint="e.g. “Inclusive of GST”" className="md:col-span-2"><Input id="tax" {...register("tax_note")} /></Field>
              <div className="md:col-span-1">
                <Controller control={control} name="show_price" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} label="Show price publicly" description="Off = behaves like price on request" />} />
              </div>
            </div>
          </Card>

          <Card title="Sizes & colours" description="Every size/colour combination is a real variant with its own SKU, stock and optional price.">
            <div id="variants" className="scroll-mt-28 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Controller control={control} name="allows_custom_size" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} label="Offer custom size (made to measure)" description="Shoppers can choose Custom Size and request a fitting consultation." />} />
                <Controller control={control} name="is_made_to_order" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} label="Made to order" description="Crafted after confirmation; shows lead time." />} />
              </div>
              <Controller control={control} name="variants" render={({ field }) => (
                <VariantsSection value={field.value} onChange={field.onChange} sizes={lookups.sizes} colors={lookups.colors} productSku={values.sku} media={values.media} errors={err} isMadeToOrder={values.is_made_to_order} />
              )} />
            </div>
          </Card>

          <Card title="Categories, collections & occasions">
            <div id="classification" className="grid scroll-mt-28 gap-5 lg:grid-cols-2">
              <Field label="Categories" error={err("category_ids")} hint="At least one is required to publish.">
                <Controller control={control} name="category_ids" render={({ field }) => <MultiCheck options={categoryOptions} value={field.value} onChange={field.onChange} height="max-h-72" />} />
              </Field>
              <div className="space-y-5">
                <Field label="Primary category" htmlFor="primary" hint="Used for breadcrumbs, size chart and recommendations.">
                  <Controller control={control} name="primary_category_id" render={({ field }) => (
                    <Select id="primary" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">First selected</option>
                      {lookups.categories.filter((c) => values.category_ids.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.path}</option>)}
                    </Select>
                  )} />
                </Field>
                <Field label="Collections">
                  <Controller control={control} name="collection_ids" render={({ field }) => <MultiCheck options={lookups.collections.map((c) => ({ value: c.id, label: c.name, hint: c.is_published ? undefined : "unpublished" }))} value={field.value} onChange={field.onChange} height="max-h-40" />} />
                </Field>
                <Field label="Occasions">
                  <Controller control={control} name="occasion_ids" render={({ field }) => <MultiCheck options={lookups.occasions.map((o) => ({ value: o.id, label: o.name }))} value={field.value} onChange={field.onChange} height="max-h-40" searchable={false} />} />
                </Field>
                <Field label="Tags" hint="Press Enter or comma to add.">
                  <Controller control={control} name="tags" render={({ field }) => <TagInput value={field.value} onChange={field.onChange} placeholder="Embroidered, Silk…" />} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
                {(["is_featured", "is_new_arrival", "is_bestseller", "is_exclusive"] as const).map((flag) => (
                  <Controller key={flag} control={control} name={flag} render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} label={{ is_featured: "Featured", is_new_arrival: "New arrival", is_bestseller: "Bestseller", is_exclusive: "Exclusive" }[flag]} />
                  )} />
                ))}
                <Field label="Recommendation priority" htmlFor="priority" hint="Higher numbers appear first in “Recommended” sorting (−100 to 100).">
                  <Input id="priority" type="number" min={-100} max={100} {...register("recommendation_priority", { valueAsNumber: true })} />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Attributes" description="Attributes assigned to the selected categories are listed first. Filterable attributes power storefront filters.">
            <div id="attributes" className="grid scroll-mt-28 gap-4 md:grid-cols-2">
              <Controller control={control} name="attributes" render={({ field }) => (
                <>
                  {relevantAttributes.map((attribute) => {
                    const row = field.value.find((a) => a.attribute_id === attribute.id) ?? { attribute_id: attribute.id, value_ids: [], value_text: "" };
                    const set = (patch: Partial<typeof row>) => field.onChange([...field.value.filter((a) => a.attribute_id !== attribute.id), { ...row, ...patch }]);
                    return (
                      <Field key={attribute.id} label={<>{attribute.name} {attribute.is_filterable && <Badge tone="blue" className="ml-1">filter</Badge>}</>}>
                        {attribute.type === "multiselect" ? (
                          <MultiCheck options={attribute.values.map((v) => ({ value: v.id, label: v.value }))} value={row.value_ids} onChange={(ids) => set({ value_ids: ids })} height="max-h-36" />
                        ) : attribute.type === "select" ? (
                          <Select aria-label={attribute.name} value={row.value_ids[0] ?? ""} onChange={(e) => set({ value_ids: e.target.value ? [Number(e.target.value)] : [] })}>
                            <option value="">—</option>
                            {attribute.values.map((v) => <option key={v.id} value={v.id}>{v.value}</option>)}
                          </Select>
                        ) : attribute.type === "boolean" ? (
                          <Select aria-label={attribute.name} value={row.value_text} onChange={(e) => set({ value_text: e.target.value })}>
                            <option value="">—</option><option value="Yes">Yes</option><option value="No">No</option>
                          </Select>
                        ) : attribute.type === "textarea" ? (
                          <Textarea aria-label={attribute.name} rows={2} value={row.value_text} onChange={(e) => set({ value_text: e.target.value })} />
                        ) : (
                          <Input aria-label={attribute.name} value={row.value_text} onChange={(e) => set({ value_text: e.target.value })} />
                        )}
                      </Field>
                    );
                  })}
                  {!relevantAttributes.length && <p className="text-sm text-slate-500">No attributes defined yet.</p>}
                </>
              )} />
            </div>
          </Card>

          <Card title="Details & delivery">
            <div id="details" className="grid scroll-mt-28 gap-4 md:grid-cols-2">
              <Field label="Set includes" htmlFor="set"><Input id="set" placeholder="Lehenga, blouse and dupatta" {...register("set_includes")} /></Field>
              <Field label="Country of origin" htmlFor="origin"><Input id="origin" {...register("country_of_origin")} /></Field>
              <Field label="Craftsmanship" htmlFor="craft" className="md:col-span-2"><Textarea id="craft" rows={3} {...register("craftsmanship")} /></Field>
              <Field label="Care instructions" htmlFor="care"><Textarea id="care" rows={3} {...register("care_instructions")} /></Field>
              <Field label="Delivery notes" htmlFor="delivery"><Textarea id="delivery" rows={3} {...register("delivery_notes")} /></Field>
              <Field label="Lead time — minimum days" htmlFor="ltmin" error={err("lead_time_min_days")}><Input id="ltmin" inputMode="numeric" {...register("lead_time_min_days")} /></Field>
              <Field label="Lead time — maximum days" htmlFor="ltmax" error={err("lead_time_max_days")}><Input id="ltmax" inputMode="numeric" {...register("lead_time_max_days")} /></Field>
              <Field label="Size chart" htmlFor="chart" hint="Defaults to the primary category’s chart.">
                <Controller control={control} name="size_chart_id" render={({ field }) => (
                  <Select id="chart" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Use category default</option>
                    {lookups.sizeCharts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                )} />
              </Field>
            </div>
          </Card>

          <Card title="Related products">
            <div id="relations" className="grid scroll-mt-28 gap-6 lg:grid-cols-2">
              <Field label="Related designs" hint="Leave empty to recommend automatically from the same category.">
                <Controller control={control} name="related_product_ids" render={({ field }) => <ProductPicker value={field.value} onChange={field.onChange} excludeId={product?.id} />} />
              </Field>
              <Field label="Complete the look">
                <Controller control={control} name="complete_the_look_ids" render={({ field }) => <ProductPicker value={field.value} onChange={field.onChange} excludeId={product?.id} max={6} />} />
              </Field>
            </div>
          </Card>

          <Card title="SEO">
            <div id="seo" className="grid scroll-mt-28 gap-4 md:grid-cols-2">
              <Field label="SEO title" htmlFor="seo_title" hint={`${seoTitle.length}/60 recommended`} error={err("seo_title")}><Input id="seo_title" placeholder={values.name} {...register("seo_title")} /></Field>
              <Field label="Canonical URL" htmlFor="canonical" hint="Leave empty to use the product URL." error={err("canonical_url")}><Input id="canonical" placeholder="https://" {...register("canonical_url")} /></Field>
              <Field label="Meta description" htmlFor="seo_desc" hint={`${values.seo_description.length}/160 recommended`} error={err("seo_description")} className="md:col-span-2"><Textarea id="seo_desc" rows={2} {...register("seo_description")} /></Field>
              <Field label="Social sharing image">
                <Controller control={control} name="og_media_id" render={({ field }) => <MediaField value={field.value} onChange={(id) => field.onChange(id)} label="Choose image" />} />
              </Field>
              <Controller control={control} name="is_indexable" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} label="Allow search engines to index" />} />
              <div className="rounded-md border border-slate-200 p-3 md:col-span-2" aria-label="Search result preview">
                <p className="truncate text-[15px] text-[#1a0dab]">{seoTitle} | Grace New Designers</p>
                <p className="truncate text-xs text-emerald-800">/products/{values.slug}</p>
                <p className="line-clamp-2 text-xs text-slate-600">{values.seo_description || values.short_description || "Add a meta description to control this snippet."}</p>
              </div>
            </div>
          </Card>

          <Card title="Internal notes" description="Visible to the team only — never exposed by the public API.">
            <div id="internal" className="scroll-mt-28"><Textarea aria-label="Internal notes" rows={3} {...register("internal_notes")} /></div>
          </Card>
        </fieldset>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card title="Publishing">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Status</span>
              <span className="flex items-center gap-1.5">{product ? <StatusBadge status={product.deleted_at ? "trashed" : product.status} /> : <StatusBadge status="draft" label="New" />}{product?.is_live && <Badge tone="green">Live</Badge>}</span>
            </div>
            {product?.published_at && <p className="text-xs text-slate-500">{product.status === "scheduled" ? "Goes live" : "Published"} {formatDateTime(product.published_at)}</p>}
            {formState.isDirty && <p className="text-xs text-amber-700">Unsaved changes</p>}
            <div className="grid gap-2 pt-1">
              <Button type="submit" variant="secondary" loading={saving === "draft"} disabled={!canEdit || !!saving}>Save {product && product.status !== "draft" ? "changes" : "draft"}</Button>
              {canPublish && (
                <>
                  <Button loading={saving === "publish"} disabled={!canEdit || !!saving} onClick={handleSubmit((d) => save(d, "publish"))}>{product?.status === "published" ? "Save & keep published" : "Publish now"}</Button>
                  <Button variant="ghost" size="sm" disabled={!canEdit || !!saving} onClick={() => setScheduleOpen(true)}>Schedule…</Button>
                </>
              )}
            </div>
          </div>
        </Card>

        {product && (
          <Card title="Actions">
            <div className="grid gap-2 text-sm">
              <Button variant="secondary" size="sm" onClick={preview}><Eye className="h-4 w-4" /> Preview (incl. drafts)</Button>
              {product.is_live && <a href={`/products/${product.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50"><ExternalLink className="h-4 w-4" /> View live</a>}
              {canEdit && <Button variant="secondary" size="sm" onClick={duplicate}><Copy className="h-4 w-4" /> Duplicate</Button>}
              {canPublish && product.status !== "archived" && !product.deleted_at && <Button variant="secondary" size="sm" onClick={() => confirm({ title: "Archive this product?", description: "It will be removed from the storefront and its page will show as no longer available (HTTP 410).", confirmLabel: "Archive", action: () => statusAction("archived") })}><Archive className="h-4 w-4" /> Archive</Button>}
              {canPublish && product.status === "archived" && <Button variant="secondary" size="sm" onClick={() => statusAction("draft")}><RotateCcw className="h-4 w-4" /> Restore to draft</Button>}
              {canPublish && !product.deleted_at && (
                <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" onClick={() => confirm({ title: "Move to trash?", description: "The product is soft-deleted and can be restored from the Trash tab.", destructive: true, confirmLabel: "Move to trash", action: async () => { await adminApi.delete(`/admin/products/${product.id}`); await queryClient.invalidateQueries({ queryKey: ["admin", "/admin/products"] }); toast.success("Moved to trash"); router.push("/admin/products"); } })}>
                  <Trash2 className="h-4 w-4" /> Move to trash
                </Button>
              )}
            </div>
          </Card>
        )}

        {product && (
          <Card title="Activity">
            <dl className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between"><dt>Created</dt><dd>{formatDateTime(product.created_at)}{product.created_by && ` · ${product.created_by}`}</dd></div>
              <div className="flex justify-between"><dt>Updated</dt><dd>{formatDateTime(product.updated_at)}{product.updated_by && ` · ${product.updated_by}`}</dd></div>
              <div className="flex justify-between"><dt>Page views</dt><dd>{product.view_count}</dd></div>
              <div className="flex justify-between"><dt>Enquiry intents</dt><dd>{product.enquiry_count}</dd></div>
            </dl>
            {can("enquiries.view") && product.enquiry_count > 0 && <Link href={`/admin/enquiries?q=${encodeURIComponent(product.sku)}`} className="mt-3 inline-block text-xs text-royal hover:underline">View enquiries</Link>}
          </Card>
        )}
      </aside>

      <Modal open={scheduleOpen} onOpenChange={setScheduleOpen} title="Schedule publishing" description="The product goes live automatically at this time (India Standard Time on your device clock)." size="sm"
        footer={<><Button variant="secondary" onClick={() => setScheduleOpen(false)}>Cancel</Button><Button disabled={!scheduleAt} loading={saving === "schedule"} onClick={handleSubmit((d) => { setScheduleOpen(false); return save(d, "schedule", new Date(scheduleAt).toISOString()); })}>Schedule</Button></>}>
        <Field label="Publish at" htmlFor="schedule_at" error={err("published_at")}>
          <Input id="schedule_at" type="datetime-local" value={scheduleAt} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} onChange={(e) => setScheduleAt(e.target.value)} />
        </Field>
      </Modal>
      {dialog}
    </form>
  );
}

