/** Admin product payload — mirrors App\Http\Resources\Admin\ProductResource and ProductRequest. */

export type PriceMode = "fixed" | "starting_from" | "on_request";
export type StockPolicy = "track" | "made_to_order" | "untracked";
export type ProductStatus = "draft" | "scheduled" | "published" | "archived";

export type VariantRow = {
  id?: number;
  sku: string;
  size_value_id: number | null;
  color_value_id: number | null;
  price: string;
  compare_at_price: string;
  stock_quantity: number;
  stock_policy: StockPolicy;
  low_stock_threshold: number;
  media_asset_id: number | null;
  is_active: boolean;
  availability?: string;
};

export type MediaRow = {
  media_asset_id: number;
  role: "gallery" | "alternate" | "detail" | "video";
  alt_text: string;
  color_value_id: number | null;
  /** Display only (not sent). */
  thumb_url?: string | null;
  kind?: string;
  name?: string;
};

export type AttributeRow = { attribute_id: number; value_ids: number[]; value_text: string };

export type ProductFormValues = {
  name: string;
  slug: string;
  sku: string;
  brand: string;
  short_description: string;
  description: string;
  department_id: number | null;
  price_mode: PriceMode;
  price: string;
  compare_at_price: string;
  cost_price: string;
  currency: string;
  show_price: boolean;
  tax_note: string;
  is_featured: boolean;
  is_new_arrival: boolean;
  is_bestseller: boolean;
  is_exclusive: boolean;
  recommendation_priority: number;
  allows_custom_size: boolean;
  is_made_to_order: boolean;
  lead_time_min_days: string;
  lead_time_max_days: string;
  set_includes: string;
  craftsmanship: string;
  care_instructions: string;
  delivery_notes: string;
  country_of_origin: string;
  size_chart_id: number | null;
  seo_title: string;
  seo_description: string;
  canonical_url: string;
  og_media_id: number | null;
  is_indexable: boolean;
  internal_notes: string;
  category_ids: number[];
  primary_category_id: number | null;
  collection_ids: number[];
  occasion_ids: number[];
  tags: string[];
  variants: VariantRow[];
  media: MediaRow[];
  attributes: AttributeRow[];
  related_product_ids: number[];
  complete_the_look_ids: number[];
};

export type AdminProduct = Omit<ProductFormValues, "price" | "compare_at_price" | "cost_price" | "lead_time_min_days" | "lead_time_max_days" | "variants" | "media" | "attributes"> & {
  id: number;
  status: ProductStatus;
  is_live: boolean;
  published_at: string | null;
  price: string | null;
  compare_at_price: string | null;
  cost_price: string | null;
  lead_time_min_days: number | null;
  lead_time_max_days: number | null;
  variants: (Omit<VariantRow, "price" | "compare_at_price"> & { id: number; price: string | null; compare_at_price: string | null })[];
  media: { id: number; media_asset_id: number; role: MediaRow["role"]; alt_text: string | null; color_value_id: number | null; asset: { kind: string; thumb_url: string | null; url: string; original_name: string } | null }[];
  attributes: { attribute_id: number; value_ids: number[]; value_text: string | null }[];
  view_count: number;
  enquiry_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProductListRow = {
  id: number;
  name: string;
  slug: string;
  sku: string;
  status: ProductStatus;
  is_live: boolean;
  published_at: string | null;
  price_mode: PriceMode;
  price_label: string;
  thumb_url: string | null;
  categories: string[];
  variant_count: number;
  out_of_stock_variants: number;
  is_featured: boolean;
  enquiry_count: number;
  updated_at: string;
  deleted_at: string | null;
};

export const emptyProduct = (): ProductFormValues => ({
  name: "", slug: "", sku: "", brand: "Grace New Designers", short_description: "", description: "", department_id: null,
  price_mode: "fixed", price: "", compare_at_price: "", cost_price: "", currency: "INR", show_price: true, tax_note: "",
  is_featured: false, is_new_arrival: true, is_bestseller: false, is_exclusive: false, recommendation_priority: 0,
  allows_custom_size: false, is_made_to_order: false, lead_time_min_days: "", lead_time_max_days: "", set_includes: "",
  craftsmanship: "", care_instructions: "", delivery_notes: "", country_of_origin: "India", size_chart_id: null,
  seo_title: "", seo_description: "", canonical_url: "", og_media_id: null, is_indexable: true, internal_notes: "",
  category_ids: [], primary_category_id: null, collection_ids: [], occasion_ids: [], tags: [],
  variants: [], media: [], attributes: [], related_product_ids: [], complete_the_look_ids: [],
});

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function toFormValues(p: AdminProduct): ProductFormValues {
  return {
    ...emptyProduct(),
    ...p,
    slug: p.slug ?? "",
    brand: p.brand ?? "",
    short_description: p.short_description ?? "",
    description: p.description ?? "",
    price: s(p.price),
    compare_at_price: s(p.compare_at_price),
    cost_price: s(p.cost_price),
    tax_note: p.tax_note ?? "",
    lead_time_min_days: s(p.lead_time_min_days),
    lead_time_max_days: s(p.lead_time_max_days),
    set_includes: p.set_includes ?? "",
    craftsmanship: p.craftsmanship ?? "",
    care_instructions: p.care_instructions ?? "",
    delivery_notes: p.delivery_notes ?? "",
    country_of_origin: p.country_of_origin ?? "",
    seo_title: p.seo_title ?? "",
    seo_description: p.seo_description ?? "",
    canonical_url: p.canonical_url ?? "",
    internal_notes: p.internal_notes ?? "",
    variants: p.variants.map((v) => ({ ...v, price: s(v.price), compare_at_price: s(v.compare_at_price) })),
    media: p.media.map((m) => ({ media_asset_id: m.media_asset_id, role: m.role, alt_text: m.alt_text ?? "", color_value_id: m.color_value_id, thumb_url: m.asset?.thumb_url ?? (m.asset?.kind === "image" ? m.asset?.url : null), kind: m.asset?.kind, name: m.asset?.original_name })),
    attributes: p.attributes.map((a) => ({ attribute_id: a.attribute_id, value_ids: a.value_ids, value_text: a.value_text ?? "" })),
  };
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** Convert form values into the API payload (empty strings → null, display-only fields removed). */
export function toPayload(v: ProductFormValues): Record<string, unknown> {
  return {
    ...v,
    slug: v.slug.trim() || null,
    price: v.price_mode === "on_request" ? null : num(v.price),
    compare_at_price: v.price_mode === "fixed" ? num(v.compare_at_price) : null,
    cost_price: num(v.cost_price),
    lead_time_min_days: num(v.lead_time_min_days),
    lead_time_max_days: num(v.lead_time_max_days),
    canonical_url: v.canonical_url.trim() || null,
    variants: v.variants.map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      sku: row.sku,
      size_value_id: row.size_value_id,
      color_value_id: row.color_value_id,
      price: num(row.price),
      compare_at_price: num(row.compare_at_price),
      stock_quantity: Number(row.stock_quantity) || 0,
      stock_policy: row.stock_policy,
      low_stock_threshold: Number(row.low_stock_threshold) || 0,
      media_asset_id: row.media_asset_id,
      is_active: row.is_active,
    })),
    media: v.media.map((m) => ({ media_asset_id: m.media_asset_id, role: m.role, alt_text: m.alt_text || null, color_value_id: m.color_value_id })),
    attributes: v.attributes.filter((a) => a.value_ids.length || a.value_text.trim()).map((a) => ({ attribute_id: a.attribute_id, value_ids: a.value_ids, value_text: a.value_text || null })),
  };
}
