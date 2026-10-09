"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button, Field, Input, MultiCheck, Select, Textarea } from "@/components/admin/ui";
import { ChoiceGroup, IconButton, LookupSelect, MediaIdField, ProductListPicker, useLookup } from "./shared";

export type SectionType =
  | "hero_image" | "hero_video" | "split_editorial" | "text_image" | "brand_story" | "category_grid" | "collection_feature"
  | "featured_products" | "occasion_grid" | "lookbook_gallery" | "craftsmanship" | "testimonials" | "newsletter" | "appointment_cta" | "social_gallery";

export type Config = Record<string, unknown>;
type Item = Record<string, unknown>;
type ErrorReader = (name: string) => string | undefined;

const THEMES = [{ value: "ivory", label: "Ivory" }, { value: "white", label: "White" }, { value: "navy", label: "Navy" }, { value: "ice", label: "Ice" }] as const;
const POSITIONS = [{ value: "left", label: "Image left" }, { value: "right", label: "Image right" }] as const;
const LAYOUTS = [{ value: "grid", label: "Grid" }, { value: "carousel", label: "Carousel" }] as const;
const LINK_HINT = "A site path starting with “/” (e.g. /collections/bridal) or a full https:// link.";

/** Typed per-section form mirroring backend SectionSchema rules. */
export function SectionConfigForm({ type, config, onChange, error }: { type: SectionType; config: Config; onChange: (c: Config) => void; error: ErrorReader }) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value });
  const p = { config, set, error };

  switch (type) {
    case "hero_image":
    case "hero_video":
      return (
        <div className="space-y-5">
          <Group title="Copy">
            <Text {...p} name="eyebrow" label="Eyebrow" max={80} />
            <Text {...p} name="headline" label="Headline" max={120} required />
            <Text {...p} name="subtitle" label="Subtitle" max={300} multiline />
          </Group>
          <Cta {...p} />
          <Group title="Media">
            {type === "hero_video" && <Media {...p} name="video_media_id" label="Video (MP4/WebM)" kind="video" required hint="Autoplays muted; the poster/desktop image shows while loading and for reduced-motion visitors." />}
            <Media {...p} name="desktop_media_id" label={type === "hero_video" ? "Poster / desktop image" : "Desktop image"} required={type === "hero_image"} hint="Landscape, at least 2000px wide." />
            <Media {...p} name="mobile_media_id" label="Mobile image" hint="Optional portrait crop for phones." />
          </Group>
          <Group title="Appearance">
            <Choice {...p} name="align" label="Text alignment" options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
            <Choice {...p} name="height" label="Height" options={[{ value: "full", label: "Full screen" }, { value: "large", label: "Large" }, { value: "medium", label: "Medium" }]} />
            <Num {...p} name="overlay_opacity" label="Overlay darkness" min={0} max={0.8} step={0.05} hint="0 = no overlay, 0.8 = darkest. Keeps text legible over bright images." />
          </Group>
        </div>
      );
    case "split_editorial":
    case "text_image":
    case "brand_story":
    case "collection_feature":
      return (
        <div className="space-y-5">
          {type === "collection_feature" && (
            <Group title="Collection">
              <Lookup {...p} name="collection_id" label="Collection" kind="collections" required />
            </Group>
          )}
          <Heading {...p} />
          <Group title="Body">
            <Text {...p} name="body" label="Body text" max={type === "collection_feature" ? 2000 : 3000} multiline rows={5} hint="Plain text. Separate paragraphs with a blank line." />
          </Group>
          <Group title="Image">
            <Media {...p} name="media_id" label="Image" hint={type === "collection_feature" ? "Leave empty to use the collection cover." : undefined} />
            <Choice {...p} name="image_position" label="Image position" options={[...POSITIONS]} />
            <Choice {...p} name="theme" label="Background theme" options={[...THEMES]} />
          </Group>
          <Cta {...p} />
        </div>
      );
    case "category_grid":
      return (
        <div className="space-y-5">
          <Heading {...p} />
          <Group title="Categories">
            <Repeater
              {...p}
              name="items"
              label="Categories"
              itemLabel="category"
              min={1}
              max={8}
              blank={{ category_id: null, label: "", media_id: null }}
              render={(item, update, prefix) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ItemField label="Category" required error={error(`${prefix}.category_id`)}>
                    {(id) => <LookupSelect id={id} kind="categories" value={item.category_id as number | null} onChange={(v) => update({ category_id: v })} invalid={!!error(`${prefix}.category_id`)} />}
                  </ItemField>
                  <ItemField label="Label override" error={error(`${prefix}.label`)} hint="Defaults to the category name.">
                    {(id) => <Input id={id} value={(item.label as string) ?? ""} maxLength={60} onChange={(e) => update({ label: e.target.value })} />}
                  </ItemField>
                  <ItemField label="Image" error={error(`${prefix}.media_id`)} hint="Defaults to the category image." className="sm:col-span-2">
                    {() => <MediaIdField value={item.media_id as number | null} onChange={(v) => update({ media_id: v })} />}
                  </ItemField>
                </div>
              )}
            />
            <Choice {...p} name="layout" label="Layout" options={[...LAYOUTS]} />
          </Group>
        </div>
      );
    case "featured_products": {
      const source = (config.source as string) ?? "new_arrivals";
      return (
        <div className="space-y-5">
          <Heading {...p} />
          <Group title="Products">
            <FieldRow label="Source" required error={error("source")}>
              {(id) => (
                <Select id={id} value={source} invalid={!!error("source")} onChange={(e) => set("source", e.target.value)}>
                  <option value="new_arrivals">New arrivals</option>
                  <option value="bestsellers">Bestsellers</option>
                  <option value="featured">Featured products</option>
                  <option value="collection">From a collection</option>
                  <option value="manual">Hand-picked products</option>
                </Select>
              )}
            </FieldRow>
            {source === "collection" && <Lookup {...p} name="collection_id" label="Collection" kind="collections" required />}
            {source === "manual" && (
              <FieldRow label="Products (in display order)" required error={error("product_ids") ?? firstPrefixed(error, "product_ids", 24)}>
                {() => <ProductListPicker value={(config.product_ids as number[]) ?? []} onChange={(ids) => set("product_ids", ids)} />}
              </FieldRow>
            )}
            {source !== "manual" && <Num {...p} name="limit" label="Number of products" min={2} max={16} step={1} integer />}
            <Choice {...p} name="layout" label="Layout" options={[...LAYOUTS]} />
          </Group>
          <Cta {...p} />
        </div>
      );
    }
    case "occasion_grid":
      return (
        <div className="space-y-5">
          <Heading {...p} />
          <Group title="Occasions">
            <OccasionPicker value={(config.occasion_ids as number[]) ?? []} onChange={(v) => set("occasion_ids", v)} error={error("occasion_ids") ?? firstPrefixed(error, "occasion_ids", 12)} />
          </Group>
        </div>
      );
    case "lookbook_gallery":
      return (
        <div className="space-y-5">
          <Heading {...p} />
          <Group title="Images">
            <Lookup {...p} name="lookbook_id" label="Lookbook" kind="lookbooks" hint="Shows images from this lookbook. Or add images manually below." />
            <Repeater
              {...p}
              name="items"
              label="Manual images"
              itemLabel="image"
              max={12}
              blank={{ media_id: null, caption: "", link_url: "" }}
              render={(item, update, prefix) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ItemField label="Image" required error={error(`${prefix}.media_id`)} className="sm:col-span-2">
                    {() => <MediaIdField value={item.media_id as number | null} onChange={(v) => update({ media_id: v })} />}
                  </ItemField>
                  <ItemField label="Caption" error={error(`${prefix}.caption`)}>
                    {(id) => <Input id={id} value={(item.caption as string) ?? ""} maxLength={120} onChange={(e) => update({ caption: e.target.value })} />}
                  </ItemField>
                  <ItemField label="Link" error={error(`${prefix}.link_url`)} hint={LINK_HINT}>
                    {(id) => <Input id={id} value={(item.link_url as string) ?? ""} maxLength={300} placeholder="/products/…" onChange={(e) => update({ link_url: e.target.value })} />}
                  </ItemField>
                </div>
              )}
            />
          </Group>
          <Cta {...p} />
        </div>
      );
    case "craftsmanship":
      return (
        <div className="space-y-5">
          <Heading {...p} />
          <Group title="Story">
            <Text {...p} name="body" label="Body text" max={2000} multiline rows={4} />
            <Media {...p} name="media_id" label="Image" />
          </Group>
          <Group title="Pillars">
            <Repeater
              {...p}
              name="pillars"
              label="Pillars"
              itemLabel="pillar"
              max={4}
              blank={{ title: "", body: "", media_id: null }}
              render={(item, update, prefix) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ItemField label="Title" required error={error(`${prefix}.title`)}>
                    {(id) => <Input id={id} value={(item.title as string) ?? ""} maxLength={80} onChange={(e) => update({ title: e.target.value })} />}
                  </ItemField>
                  <ItemField label="Image" error={error(`${prefix}.media_id`)}>
                    {() => <MediaIdField value={item.media_id as number | null} onChange={(v) => update({ media_id: v })} />}
                  </ItemField>
                  <ItemField label="Description" error={error(`${prefix}.body`)} className="sm:col-span-2">
                    {(id) => <Textarea id={id} rows={2} value={(item.body as string) ?? ""} maxLength={500} onChange={(e) => update({ body: e.target.value })} />}
                  </ItemField>
                </div>
              )}
            />
          </Group>
          <Cta {...p} />
        </div>
      );
    case "testimonials":
      return (
        <div className="space-y-5">
          <Heading {...p} />
          <Group title="Display">
            <Num {...p} name="limit" label="Maximum testimonials" min={1} max={12} step={1} integer hint="Only approved testimonials with confirmed client consent are shown." />
          </Group>
        </div>
      );
    case "newsletter":
      return (
        <div className="space-y-5">
          <Heading {...p} />
          <Group title="Copy">
            <Text {...p} name="body" label="Body text" max={500} multiline rows={3} />
            <Text {...p} name="consent_text" label="Consent text" max={300} multiline rows={2} hint="Shown beside the sign-up form, e.g. how often you email and how to unsubscribe." />
          </Group>
        </div>
      );
    case "appointment_cta":
      return (
        <div className="space-y-5">
          <Heading {...p} />
          <Group title="Copy & image">
            <Text {...p} name="body" label="Body text" max={1000} multiline rows={3} />
            <Media {...p} name="media_id" label="Image" />
            <Text {...p} name="consultation_label" label="Consultation button label" max={60} />
            <Text {...p} name="whatsapp_label" label="WhatsApp button label" max={60} />
          </Group>
        </div>
      );
    case "social_gallery":
      return (
        <div className="space-y-5">
          <Heading {...p} />
          <Group title="Profile">
            <Text {...p} name="handle" label="Handle" max={60} placeholder="@gracenewdesigners" />
            <Text {...p} name="profile_url" label="Profile URL" max={300} placeholder="https://instagram.com/…" hint="Full URL to the social profile." />
          </Group>
          <Group title="Images">
            <Repeater
              {...p}
              name="items"
              label="Images"
              itemLabel="image"
              max={12}
              blank={{ media_id: null, link_url: "", alt: "" }}
              render={(item, update, prefix) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ItemField label="Image" required error={error(`${prefix}.media_id`)} className="sm:col-span-2">
                    {() => <MediaIdField value={item.media_id as number | null} onChange={(v) => update({ media_id: v })} />}
                  </ItemField>
                  <ItemField label="Post link" error={error(`${prefix}.link_url`)} hint="Full https:// URL of the post.">
                    {(id) => <Input id={id} value={(item.link_url as string) ?? ""} maxLength={300} onChange={(e) => update({ link_url: e.target.value })} />}
                  </ItemField>
                  <ItemField label="Alt text" error={error(`${prefix}.alt`)}>
                    {(id) => <Input id={id} value={(item.alt as string) ?? ""} maxLength={200} onChange={(e) => update({ alt: e.target.value })} />}
                  </ItemField>
                </div>
              )}
            />
          </Group>
        </div>
      );
    default:
      return <p className="text-sm text-slate-500">This section type has no editable settings.</p>;
  }
}

/** Remove keys the backend would reject for this type and normalise blank values. */
export function cleanConfig(type: SectionType, config: Config): Config {
  const out: Config = { ...config };
  if (type !== "hero_video") delete out.video_media_id;
  if (type === "featured_products") {
    if (out.source !== "collection") out.collection_id = null;
    if (out.source !== "manual") delete out.product_ids;
  }
  for (const [k, v] of Object.entries(out)) if (v === "") out[k] = null;
  for (const key of ["items", "pillars"]) {
    if (Array.isArray(out[key])) out[key] = (out[key] as Item[]).map((it) => Object.fromEntries(Object.entries(it).map(([k, v]) => [k, v === "" ? null : v])));
  }
  return out;
}

// ---- Building blocks -------------------------------------------------------------------------------

type P = { config: Config; set: (key: string, value: unknown) => void; error: ErrorReader };

function firstPrefixed(error: ErrorReader, name: string, max: number): string | undefined {
  for (let i = 0; i < max; i += 1) {
    const e = error(`${name}.${i}`);
    if (e) return e;
  }
  return undefined;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

function FieldRow({ label, hint, error, required, children, className }: { label: string; hint?: ReactNode; error?: string; required?: boolean; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      {children(id)}
    </Field>
  );
}
const ItemField = FieldRow;

function Text({ config, set, error, name, label, max, required, multiline, rows = 3, hint, placeholder }: P & { name: string; label: string; max: number; required?: boolean; multiline?: boolean; rows?: number; hint?: string; placeholder?: string }) {
  const value = (config[name] as string) ?? "";
  const count = <span className={value.length > max ? "text-red-600" : ""}>{value.length}/{max}</span>;
  return (
    <FieldRow label={label} required={required} error={error(name)} hint={hint ? <>{hint} · {count}</> : count}>
      {(id) => (multiline ? (
        <Textarea id={id} rows={rows} value={value} maxLength={max} placeholder={placeholder} invalid={!!error(name)} onChange={(e) => set(name, e.target.value)} />
      ) : (
        <Input id={id} value={value} maxLength={max} placeholder={placeholder} required={required} invalid={!!error(name)} onChange={(e) => set(name, e.target.value)} />
      ))}
    </FieldRow>
  );
}

function Num({ config, set, error, name, label, min, max, step, integer, hint }: P & { name: string; label: string; min: number; max: number; step: number; integer?: boolean; hint?: string }) {
  const raw = config[name];
  return (
    <FieldRow label={label} error={error(name)} hint={hint ?? `Between ${min} and ${max}.`}>
      {(id) => (
        <Input
          id={id}
          type="number"
          className="max-w-40"
          min={min}
          max={max}
          step={step}
          value={raw === null || raw === undefined ? "" : String(raw)}
          invalid={!!error(name)}
          onChange={(e) => set(name, e.target.value === "" ? null : integer ? Math.round(Number(e.target.value)) : Number(e.target.value))}
        />
      )}
    </FieldRow>
  );
}

function Choice({ config, set, error, name, label, options }: P & { name: string; label: string; options: { value: string; label: string }[] }) {
  return (
    <Field label={<span>{label}</span>} error={error(name)}>
      <ChoiceGroup label={label} value={(config[name] as string) ?? null} onChange={(v) => set(name, v)} options={options} allowEmpty />
    </Field>
  );
}

function Media({ config, set, error, name, label, kind = "image", required, hint }: P & { name: string; label: string; kind?: "image" | "video"; required?: boolean; hint?: string }) {
  return (
    <Field label={label} required={required} error={error(name)} hint={hint}>
      <MediaIdField value={config[name] as number | null} onChange={(v) => set(name, v)} kind={kind} />
    </Field>
  );
}

function Lookup({ config, set, error, name, label, kind, required, hint }: P & { name: string; label: string; kind: "collections" | "lookbooks"; required?: boolean; hint?: string }) {
  return (
    <FieldRow label={label} required={required} error={error(name)} hint={hint}>
      {(id) => <LookupSelect id={id} kind={kind} value={config[name] as number | null} onChange={(v) => set(name, v)} invalid={!!error(name)} placeholder={required ? undefined : "— None —"} />}
    </FieldRow>
  );
}

function Heading(p: P) {
  return (
    <Group title="Heading">
      <Text {...p} name="eyebrow" label="Eyebrow" max={80} />
      <Text {...p} name="title" label="Title" max={140} />
      <Text {...p} name="subtitle" label="Subtitle" max={300} multiline rows={2} />
    </Group>
  );
}

function Cta(p: P) {
  return (
    <Group title="Call to action">
      <div className="grid gap-4 sm:grid-cols-2">
        <Text {...p} name="cta_label" label="Button label" max={60} />
        <Text {...p} name="cta_url" label="Button link" max={300} placeholder="/collections" hint={LINK_HINT} />
      </div>
    </Group>
  );
}

function OccasionPicker({ value, onChange, error }: { value: number[]; onChange: (v: number[]) => void; error?: string }) {
  const { options, isLoading, error: loadError } = useLookup("occasions");
  return (
    <Field label="Occasions to show" error={error} hint={`Leave all unticked to show every published occasion. ${value.length}/12 selected.`}>
      {loadError ? <p className="text-xs text-amber-800">Couldn’t load occasions.</p> : isLoading ? <p className="text-xs text-slate-500">Loading…</p> : <MultiCheck options={options} value={value} onChange={(v) => onChange(v.slice(0, 12))} />}
    </Field>
  );
}

function Repeater({ config, set, name, label, itemLabel, min = 0, max, blank, render, error }: P & { name: string; label: string; itemLabel: string; min?: number; max: number; blank: Item; render: (item: Item, update: (patch: Item) => void, prefix: string) => ReactNode }) {
  const items = (config[name] as Item[] | undefined) ?? [];
  const write = (next: Item[]) => set(name, next);
  const move = (i: number, dir: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    write(next);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800">{label} <span className="font-normal text-slate-400">({items.length}/{max})</span></span>
        <Button size="sm" variant="secondary" disabled={items.length >= max} onClick={() => write([...items, { ...blank }])}><Plus className="h-3.5 w-3.5" /> Add {itemLabel}</Button>
      </div>
      {error(name) && <p className="text-xs text-red-700" role="alert">{error(name)}</p>}
      {items.length === 0 && <p className="rounded-md border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">{min > 0 ? `Add at least ${min} ${itemLabel}.` : `No ${itemLabel}s added.`}</p>}
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 capitalize">{itemLabel} {i + 1}</span>
              <div className="flex">
                <IconButton label={`Move ${itemLabel} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
                <IconButton label={`Move ${itemLabel} ${i + 1} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
                <IconButton label={`Remove ${itemLabel} ${i + 1}`} disabled={items.length <= min} onClick={() => write(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></IconButton>
              </div>
            </div>
            {render(item, (patch) => write(items.map((x, j) => (j === i ? { ...x, ...patch } : x))), `${name}.${i}`)}
          </li>
        ))}
      </ol>
    </div>
  );
}
