"use client";

import { ExternalLink, Info, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo, useState, type ReactNode } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { MediaField } from "@/components/admin/media-picker";
import { bool, str, useSaveSettings, useSettings, type SettingsGroups } from "@/components/admin/system/settings";
import { Button, Card, ErrorNotice, Field, Input, PageHeader, Spinner, Switch, Tabs, Textarea } from "@/components/admin/ui";
import { useAdminQuery, useUnsavedChangesWarning, useUrlState } from "@/lib/admin/hooks";
import type { AdminMedia } from "@/components/admin/media-picker";

// ---- Field definitions -----------------------------------------------------------------------------

type Color = { name: string; hex: string };
type FieldType = "text" | "email" | "url" | "tel" | "textarea" | "switch" | "number" | "media" | "colors" | "whatsapp" | "currency" | "timezone";
type FieldDef = { key: string; label: string; type: FieldType; hint?: ReactNode; placeholder?: string; max?: number; min?: number; required?: boolean; wide?: boolean };
type FormValue = string | boolean | number | null | Color[];
type Values = Record<string, FormValue>;

const WHATSAPP_RE = /^\+[1-9]\d{7,14}$/;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const LOGO_HINT = "Logos keep their original aspect ratio. Until one is uploaded the storefront shows a typographic placeholder.";

const GROUPS: { value: string; label: string; title: string; description: ReactNode; fields: FieldDef[] }[] = [
  {
    value: "brand",
    label: "Brand",
    title: "Brand identity",
    description: "Name, tagline and logo variants used across the storefront, emails and social previews.",
    fields: [
      { key: "brand_name", label: "Brand name", type: "text", max: 120, required: true },
      { key: "tagline", label: "Tagline", type: "text", max: 160 },
      { key: "brand_description", label: "Brand description", type: "textarea", max: 2000, wide: true, hint: "Used in the footer and as a fallback description." },
      { key: "logo_primary_media_id", label: "Primary logo", type: "media", hint: LOGO_HINT },
      { key: "logo_dark_bg_media_id", label: "Logo for dark backgrounds", type: "media", hint: "Light-coloured version shown on dark sections." },
      { key: "logo_light_bg_media_id", label: "Logo for light backgrounds", type: "media", hint: "Dark-coloured version shown on light sections." },
      { key: "logo_mobile_media_id", label: "Mobile / compact logo", type: "media", hint: "A monogram or short mark for small screens." },
      { key: "favicon_media_id", label: "Favicon", type: "media", hint: "Square image, at least 512 × 512 px." },
      { key: "social_share_media_id", label: "Default social share image", type: "media", hint: "Shown when links are shared on WhatsApp, Instagram or Facebook. 1200 × 630 px recommended." },
      { key: "brand_colors", label: "Brand colours (optional)", type: "colors", wide: true, hint: "Named hex colours for reference and email styling, e.g. “primary” → #1F3A5F." },
    ],
  },
  {
    value: "contact",
    label: "Contact",
    title: "Contact details",
    description: "Shown on the contact page, footer and structured data for search engines. Leave anything unknown empty.",
    fields: [
      { key: "contact_email", label: "Email", type: "email", max: 190 },
      { key: "contact_phone", label: "Phone", type: "tel", max: 40, placeholder: "+91 …" },
      { key: "address", label: "Studio address", type: "textarea", max: 500, wide: true },
      { key: "business_hours", label: "Business hours", type: "textarea", max: 300, wide: true, placeholder: "e.g. Mon–Sat, 11 am – 8 pm" },
      { key: "map_url", label: "Map link", type: "url", max: 500, wide: true, placeholder: "https://maps.google.com/…", hint: "A Google Maps share link to your studio." },
    ],
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    title: "WhatsApp enquiries",
    description: "Product, bag and consultation enquiries open a pre-filled WhatsApp chat with this number.",
    fields: [
      { key: "whatsapp_enabled", label: "WhatsApp enquiries enabled", type: "switch", wide: true, hint: "When off, or when no number is set, the storefront hides WhatsApp buttons and offers the enquiry form instead." },
      { key: "whatsapp_business_number", label: "WhatsApp Business number", type: "whatsapp", wide: true, placeholder: "+919876543210", hint: "International format: + country code and number, no spaces or dashes." },
      { key: "whatsapp_closing_line", label: "Closing line", type: "textarea", max: 300, wide: true, hint: "Added at the end of every pre-filled enquiry message." },
    ],
  },
  {
    value: "social",
    label: "Social",
    title: "Social profiles",
    description: "Full profile URLs. Empty profiles are hidden on the storefront.",
    fields: [
      { key: "social_instagram", label: "Instagram", type: "url", max: 300, placeholder: "https://instagram.com/…" },
      { key: "social_facebook", label: "Facebook", type: "url", max: 300, placeholder: "https://facebook.com/…" },
      { key: "social_pinterest", label: "Pinterest", type: "url", max: 300, placeholder: "https://pinterest.com/…" },
      { key: "social_youtube", label: "YouTube", type: "url", max: 300, placeholder: "https://youtube.com/@…" },
      { key: "social_x", label: "X (Twitter)", type: "url", max: 300, placeholder: "https://x.com/…" },
    ],
  },
  {
    value: "store",
    label: "Store",
    title: "Storefront",
    description: "Public domain, currency and storefront features.",
    fields: [
      { key: "site_url", label: "Public site URL", type: "url", max: 300, wide: true, placeholder: "https://", hint: "Your live domain. Used to build product links inside WhatsApp messages, emails and sitemaps." },
      { key: "currency", label: "Currency", type: "currency", required: true, hint: "Three-letter ISO code, e.g. INR." },
      { key: "timezone", label: "Timezone", type: "timezone", required: true, hint: "Used for schedules and reports." },
      { key: "announcement_enabled", label: "Show announcement bar", type: "switch", wide: true },
      { key: "announcement_text", label: "Announcement text", type: "text", max: 200, wide: true },
      { key: "announcement_link", label: "Announcement link", type: "text", max: 300, wide: true, placeholder: "/collections/… or https://…" },
      { key: "newsletter_enabled", label: "Newsletter sign-up", type: "switch", wide: true, hint: "Shows the newsletter form in the footer." },
      { key: "consultation_enabled", label: "Consultation booking", type: "switch", wide: true, hint: "Lets visitors request a styling consultation." },
      { key: "shipping_note", label: "Shipping note", type: "textarea", max: 1000, wide: true, hint: "Shown on product pages." },
    ],
  },
  {
    value: "privacy",
    label: "Privacy",
    title: "Privacy & data retention",
    description: "Personal data is deleted or anonymised automatically after these periods.",
    fields: [
      { key: "enquiry_retention_months", label: "Keep enquiries for (months)", type: "number", min: 1, max: 120, required: true, hint: "1–120 months. Older enquiries are anonymised." },
      { key: "analytics_retention_days", label: "Keep analytics events for (days)", type: "number", min: 7, max: 1095, required: true, hint: "7–1095 days." },
    ],
  },
  {
    value: "notifications",
    label: "Notifications",
    title: "Notifications",
    description: "Email alerts for the studio team.",
    fields: [
      { key: "notify_new_enquiry_email", label: "Send new-enquiry alerts to", type: "email", wide: true, hint: "Leave empty to turn off enquiry emails." },
      { key: "notify_low_stock", label: "Low-stock alerts", type: "switch", wide: true, hint: "Email when a live product variant runs low." },
    ],
  },
];

const TIMEZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
})();

function toForm(def: FieldDef, raw: unknown): FormValue {
  switch (def.type) {
    case "switch":
      return bool(raw);
    case "media":
      return raw === null || raw === undefined || raw === "" ? null : Number(raw);
    case "colors":
      return raw && typeof raw === "object" && !Array.isArray(raw) ? Object.entries(raw as Record<string, unknown>).map(([name, hex]) => ({ name, hex: str(hex) })) : [];
    default:
      return str(raw);
  }
}

function toPayload(def: FieldDef, value: FormValue): unknown {
  switch (def.type) {
    case "switch":
      return Boolean(value);
    case "media":
      return value;
    case "number":
      return value === "" ? null : Number(value);
    case "colors": {
      const list = (value as Color[]).filter((c) => c.name.trim() || c.hex.trim());
      return list.length ? Object.fromEntries(list.map((c) => [c.name.trim(), c.hex.trim()])) : null;
    }
    case "currency":
      return str(value).trim().toUpperCase();
    default: {
      const s = str(value).trim();
      return def.required ? s : s === "" ? null : s;
    }
  }
}

function validate(def: FieldDef, value: FormValue): string | undefined {
  const s = typeof value === "string" ? value.trim() : "";
  if (def.required && def.type !== "switch" && def.type !== "colors" && s === "") return `${def.label} is required.`;
  if (def.type === "whatsapp" && s && !WHATSAPP_RE.test(s)) return "Enter the number in international format, e.g. +919876543210 (country code, no spaces).";
  if (def.type === "number" && s) {
    const n = Number(s);
    if (!Number.isInteger(n) || (def.min !== undefined && n < def.min) || (def.max !== undefined && n > def.max)) return `Enter a whole number between ${def.min} and ${def.max}.`;
  }
  if (def.type === "currency" && s && !/^[A-Za-z]{3}$/.test(s)) return "Use a three-letter currency code.";
  if (def.type === "url" && s && !/^https?:\/\/\S+$/i.test(s)) return "Enter a full URL starting with https://";
  if (def.type === "colors") {
    const list = (value as Color[]).filter((c) => c.name.trim() || c.hex.trim());
    if (list.some((c) => !c.name.trim())) return "Give every colour a name.";
    if (list.some((c) => !HEX_RE.test(c.hex.trim()))) return "Colours must be 6-digit hex values like #1F3A5F.";
    if (new Set(list.map((c) => c.name.trim())).size !== list.length) return "Colour names must be unique.";
  }
  return undefined;
}

const same = (a: FormValue, b: FormValue) => JSON.stringify(a) === JSON.stringify(b);

// ---- Page ------------------------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <RequirePermission permission="settings.manage">
      <PageHeader title="Settings" description={<>Brand, contact, WhatsApp and storefront settings. Search-engine and analytics settings live under <Link href="/admin/seo?tab=search" className="text-royal hover:underline">SEO & marketing</Link>.</>} />
      <Suspense fallback={<Spinner />}>
        <SettingsLoader />
      </Suspense>
    </RequirePermission>
  );
}

function SettingsLoader() {
  const { data, isLoading, error, refetch } = useSettings();
  if (isLoading) return <Spinner label="Loading settings" />;
  if (error || !data) return <ErrorNotice error={error} onRetry={() => refetch()} />;
  return <SettingsEditor groups={data.data} />;
}

function fromGroups(groups: SettingsGroups): Values {
  const values: Values = {};
  for (const g of GROUPS) for (const def of g.fields) values[def.key] = toForm(def, groups[g.value]?.[def.key]);
  return values;
}

function SettingsEditor({ groups }: { groups: SettingsGroups }) {
  const [state, setState] = useUrlState({ tab: "brand" });
  const [initial, setInitial] = useState<Values>(() => fromGroups(groups));
  const [values, setValues] = useState<Values>(initial);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const save = useSaveSettings();

  const group = GROUPS.find((g) => g.value === state.tab) ?? GROUPS[0];
  const dirtyGroups = useMemo(() => new Set(GROUPS.filter((g) => g.fields.some((f) => !same(values[f.key], initial[f.key]))).map((g) => g.value)), [values, initial]);
  useUnsavedChangesWarning(dirtyGroups.size > 0);
  const dirty = dirtyGroups.has(group.value);

  const set = (key: string, value: FormValue) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (clientErrors[key]) setClientErrors((errors) => Object.fromEntries(Object.entries(errors).filter(([k]) => k !== key)));
  };

  const submit = () => {
    const errors: Record<string, string> = {};
    for (const def of group.fields) {
      const e = validate(def, values[def.key]);
      if (e) errors[def.key] = e;
    }
    setClientErrors(errors);
    if (Object.keys(errors).length) return;
    const payload = Object.fromEntries(group.fields.map((def) => [def.key, toPayload(def, values[def.key])]));
    save.mutate(payload, {
      onSuccess: (result) => {
        const fresh = fromGroups(result.data);
        const keys = group.fields.map((f) => f.key);
        setInitial((i) => ({ ...i, ...Object.fromEntries(keys.map((k) => [k, fresh[k]])) }));
        setValues((v) => ({ ...v, ...Object.fromEntries(keys.map((k) => [k, fresh[k]])) }));
      },
    });
  };

  const discard = () => {
    setValues((v) => ({ ...v, ...Object.fromEntries(group.fields.map((f) => [f.key, initial[f.key]])) }));
    setClientErrors({});
  };

  const errorFor = (key: string) => clientErrors[key] ?? save.fieldError(key) ?? Object.entries(save.fieldErrors).find(([k]) => k.startsWith(`${key}.`))?.[1]?.[0];

  return (
    <div className="space-y-6">
      <Tabs
        tabs={GROUPS.map((g) => ({ value: g.value, label: <>{g.label}{dirtyGroups.has(g.value) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="unsaved changes" />}</> }))}
        active={group.value}
        onChange={(tab) => {
          setClientErrors({});
          save.setFieldErrors({});
          setState({ tab });
        }}
      />
      <Card title={group.title} description={group.description}>
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          {group.value === "store" && !values.site_url && (
            <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> No public site URL is set yet, so WhatsApp product links use the development address. Set it once your domain is live.</p>
          )}
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            {group.fields.map((def) => (
              <SettingField key={def.key} def={def} value={values[def.key]} onChange={(v) => set(def.key, v)} error={errorFor(def.key)} values={values} />
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            {dirty && <span className="mr-auto text-xs text-amber-700">Unsaved changes</span>}
            <Button variant="secondary" disabled={!dirty} onClick={discard}>Discard</Button>
            <Button type="submit" loading={save.isPending} disabled={!dirty}>Save {group.label.toLowerCase()} settings</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function SettingField({ def, value, onChange, error, values }: { def: FieldDef; value: FormValue; onChange: (v: FormValue) => void; error?: string; values: Values }) {
  const id = `setting-${def.key}`;
  const wide = def.wide ? "md:col-span-2" : undefined;

  if (def.type === "switch") {
    return (
      <div className={wide}>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} label={def.label} description={def.hint} />
        {error && <p className="mt-1 text-xs text-red-700" role="alert">{error}</p>}
      </div>
    );
  }
  if (def.type === "media") {
    return (
      <Field label={def.label} hint={def.hint} error={error} className={wide}>
        <ResolvedMediaField value={value as number | null} onChange={(id) => onChange(id)} label={`Choose ${def.label.toLowerCase()}`} />
      </Field>
    );
  }
  if (def.type === "colors") {
    return (
      <Field label={def.label} hint={def.hint} error={error} className={wide}>
        <ColorsEditor value={value as Color[]} onChange={onChange} />
      </Field>
    );
  }
  if (def.type === "textarea") {
    const s = str(value);
    return (
      <Field label={def.label} htmlFor={id} required={def.required} error={error} hint={<>{def.hint}{def.hint && def.max ? " · " : ""}{def.max ? `${s.length}/${def.max}` : ""}</>} className={wide}>
        <Textarea id={id} rows={3} value={s} maxLength={def.max} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} invalid={!!error} />
      </Field>
    );
  }
  if (def.type === "whatsapp") {
    const s = str(value).trim();
    const valid = WHATSAPP_RE.test(s);
    return (
      <Field label={def.label} htmlFor={id} error={error} hint={def.hint} className={wide}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id={id} type="tel" inputMode="tel" value={str(value)} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value.replace(/[\s()-]/g, ""))} invalid={!!error || (s !== "" && !valid)} className="sm:max-w-xs" />
          {valid ? (
            <a href={`https://wa.me/${s.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
              Test link <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : (
            <span className="self-center text-xs text-slate-500">{s ? "Not a valid international number yet." : "No number set — WhatsApp buttons are hidden on the storefront."}</span>
          )}
        </div>
        {!values.whatsapp_enabled && s && <p className="mt-1 text-xs text-amber-700">WhatsApp enquiries are switched off, so this number is not used.</p>}
      </Field>
    );
  }
  if (def.type === "timezone") {
    return (
      <Field label={def.label} htmlFor={id} required={def.required} error={error} hint={def.hint} className={wide}>
        <Input id={id} list={`${id}-list`} value={str(value)} onChange={(e) => onChange(e.target.value)} invalid={!!error} autoComplete="off" />
        <datalist id={`${id}-list`}>{TIMEZONES.map((tz) => <option key={tz} value={tz} />)}</datalist>
      </Field>
    );
  }
  const inputType = def.type === "number" ? "number" : def.type === "email" ? "email" : def.type === "url" ? "url" : def.type === "tel" ? "tel" : "text";
  return (
    <Field label={def.label} htmlFor={id} required={def.required} error={error} hint={def.hint} className={wide}>
      <Input
        id={id}
        type={inputType}
        value={str(value)}
        maxLength={def.type === "currency" ? 3 : def.type === "number" ? undefined : def.max}
        min={def.type === "number" ? def.min : undefined}
        max={def.type === "number" ? def.max : undefined}
        placeholder={def.placeholder}
        onChange={(e) => onChange(def.type === "currency" ? e.target.value.toUpperCase() : e.target.value)}
        invalid={!!error}
        className={def.type === "currency" || def.type === "number" ? "max-w-40" : undefined}
      />
    </Field>
  );
}

/** MediaField with its thumbnail resolved from the stored media id. */
function ResolvedMediaField({ value, onChange, label }: { value: number | null; onChange: (id: number | null) => void; label: string }) {
  const { data, isLoading } = useAdminQuery<{ data: AdminMedia }>(value ? `/admin/media/${value}` : null);
  const preview = data?.data ? data.data.thumb_url ?? (data.data.kind === "image" ? data.data.url : null) : null;
  if (value && isLoading) return <div className="h-16 w-16 animate-pulse rounded-md bg-slate-100" aria-label="Loading image" />;
  return (
    <div>
      <MediaField key={`${value ?? "none"}-${preview ? "p" : "n"}`} value={value} preview={preview} onChange={(id) => onChange(id)} label={label} />
      {data?.data && <p className="mt-1 truncate text-xs text-slate-500">{data.data.original_name}{data.data.width && data.data.height ? ` · ${data.data.width}×${data.data.height}` : ""}</p>}
    </div>
  );
}

function ColorsEditor({ value, onChange }: { value: Color[]; onChange: (v: Color[]) => void }) {
  const update = (i: number, patch: Partial<Color>) => onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-sm text-slate-500">No colours defined.</p>}
      {value.map((c, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input aria-label={`Colour ${i + 1} name`} value={c.name} placeholder="name, e.g. primary" onChange={(e) => update(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_") })} className="w-44" />
          <input type="color" aria-label={`Colour ${i + 1} picker`} value={HEX_RE.test(c.hex) ? c.hex : "#000000"} onChange={(e) => update(i, { hex: e.target.value.toUpperCase() })} className="h-10 w-12 cursor-pointer rounded-md border border-slate-300 bg-white p-1" />
          <Input aria-label={`Colour ${i + 1} hex value`} value={c.hex} placeholder="#000000" maxLength={7} onChange={(e) => update(i, { hex: e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}` })} className="w-28 font-mono" invalid={!!c.hex && !HEX_RE.test(c.hex)} />
          <Button variant="ghost" size="sm" onClick={() => onChange(value.filter((_, idx) => idx !== i))} aria-label={`Remove colour ${c.name || i + 1}`}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => onChange([...value, { name: "", hex: "" }])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add colour</Button>
    </div>
  );
}
