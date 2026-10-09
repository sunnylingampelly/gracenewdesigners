"use client";

import { Field, Switch } from "@/components/admin/ui";
import { MediaField } from "@/components/admin/media-picker";
import { isoToLocalInput, localInputToIso, slugify, textOrNull, toInt } from "./form-utils";
import { FormSection, SeoFields, TextAreaField, TextField } from "./shared";
import type { Collection } from "./types";

export type CollectionFormState = {
  name: string;
  slug: string;
  tagline: string;
  story: string;
  cover_media_id: number | null;
  banner_media_id: number | null;
  starts_at: string;
  ends_at: string;
  is_published: boolean;
  is_featured: boolean;
  sort_order: string;
  seo_title: string;
  seo_description: string;
};

export function collectionFormState(c: Collection | null): CollectionFormState {
  return {
    name: c?.name ?? "",
    slug: c?.slug ?? "",
    tagline: c?.tagline ?? "",
    story: c?.story ?? "",
    cover_media_id: c?.cover_media_id ?? null,
    banner_media_id: c?.banner_media_id ?? null,
    starts_at: isoToLocalInput(c?.starts_at),
    ends_at: isoToLocalInput(c?.ends_at),
    is_published: c?.is_published ?? false,
    is_featured: c?.is_featured ?? false,
    sort_order: String(c?.sort_order ?? 0),
    seo_title: c?.seo_title ?? "",
    seo_description: c?.seo_description ?? "",
  };
}

export function collectionPayload(f: CollectionFormState) {
  return {
    name: f.name.trim(),
    slug: textOrNull(f.slug),
    tagline: textOrNull(f.tagline),
    story: textOrNull(f.story),
    cover_media_id: f.cover_media_id,
    banner_media_id: f.banner_media_id,
    starts_at: localInputToIso(f.starts_at),
    ends_at: localInputToIso(f.ends_at),
    is_published: f.is_published,
    is_featured: f.is_featured,
    sort_order: toInt(f.sort_order),
    seo_title: textOrNull(f.seo_title),
    seo_description: textOrNull(f.seo_description),
  };
}

export function CollectionFields({ value, onChange, fieldError, coverPreview, bannerPreview }: { value: CollectionFormState; onChange: (v: CollectionFormState) => void; fieldError: (name: string) => string | undefined; coverPreview?: string | null; bannerPreview?: string | null }) {
  const set = (patch: Partial<CollectionFormState>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-6">
      <FormSection title="Story">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" required value={value.name} onChange={(v) => set({ name: v })} error={fieldError("name")} maxLength={150} />
          <TextField label="Slug" value={value.slug} onChange={(v) => set({ slug: v.toLowerCase() })} error={fieldError("slug")} placeholder={slugify(value.name)} maxLength={150} hint={<>URL: <span className="font-mono">/collections/{slugify(value.slug || value.name) || "…"}</span></>} />
        </div>
        <TextField label="Tagline" value={value.tagline} onChange={(v) => set({ tagline: v })} error={fieldError("tagline")} maxLength={255} />
        <TextAreaField label="Story" rows={5} value={value.story} onChange={(v) => set({ story: v })} error={fieldError("story")} maxLength={5000} hint="The editorial narrative shown on the collection page." />
      </FormSection>
      <FormSection title="Imagery">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cover image" error={fieldError("cover_media_id")} hint="Used on collection tiles.">
            <MediaField value={value.cover_media_id} preview={coverPreview} onChange={(id) => set({ cover_media_id: id })} label="Choose cover" />
          </Field>
          <Field label="Banner image" error={fieldError("banner_media_id")} hint="Wide header on the collection page.">
            <MediaField value={value.banner_media_id} preview={bannerPreview} onChange={(id) => set({ banner_media_id: id })} label="Choose banner" />
          </Field>
        </div>
      </FormSection>
      <FormSection title="Season & visibility">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Starts" type="datetime-local" value={value.starts_at} onChange={(v) => set({ starts_at: v })} error={fieldError("starts_at")} hint="Optional season start." />
          <TextField label="Ends" type="datetime-local" value={value.ends_at} onChange={(v) => set({ ends_at: v })} error={fieldError("ends_at")} hint="Optional; must be after the start." />
          <TextField label="Sort order" type="number" value={value.sort_order} onChange={(v) => set({ sort_order: v })} error={fieldError("sort_order")} />
        </div>
        <div className="space-y-4 rounded-md border border-slate-200 p-4">
          <Switch label="Published" description="Visible on the storefront (within the season window, if set)." checked={value.is_published} onCheckedChange={(v) => set({ is_published: v })} />
          <Switch label="Featured" description="Highlight on the homepage and collection index." checked={value.is_featured} onCheckedChange={(v) => set({ is_featured: v })} />
        </div>
      </FormSection>
      <SeoFields value={value} onChange={(v) => onChange({ ...value, ...v })} fieldError={fieldError} />
    </div>
  );
}

/** "12 Oct 2026 – 30 Nov 2026", "From 12 Oct 2026", or "Always". */
export function seasonLabel(c: Pick<Collection, "starts_at" | "ends_at">): string {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (c.starts_at && c.ends_at) return `${fmt(c.starts_at)} – ${fmt(c.ends_at)}`;
  if (c.starts_at) return `From ${fmt(c.starts_at)}`;
  if (c.ends_at) return `Until ${fmt(c.ends_at)}`;
  return "Always";
}
