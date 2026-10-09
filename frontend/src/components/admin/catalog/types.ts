/** Shapes returned by the admin taxonomy endpoints (see CategoryController / CollectionController / CatalogSetupController). */

export type Department = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  banner_media_id: number | null;
  sort_order: number;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  products_count: number;
  categories_count: number;
  banner_url: string | null;
};

export type Category = {
  id: number;
  department_id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  path: string;
  depth: number;
  intro: string | null;
  banner_media_id: number | null;
  image_media_id: number | null;
  size_chart_id: number | null;
  sort_order: number;
  is_published: boolean;
  show_in_menu: boolean;
  hide_when_empty: boolean;
  seo_title: string | null;
  seo_description: string | null;
  products_count: number;
  image_url: string | null;
  banner_url: string | null;
  attribute_ids: number[];
};

export type Collection = {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  story: string | null;
  cover_media_id: number | null;
  banner_media_id: number | null;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  products_count: number;
  cover_url: string | null;
  banner_url: string | null;
};

export type CollectionProduct = { id: number; name: string; sku: string | null; status: string; thumb_url: string | null };
export type CollectionDetail = Collection & { products: CollectionProduct[] };

export type Occasion = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_media_id: number | null;
  sort_order: number;
  is_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
  products_count: number;
  image_url: string | null;
};

export const ATTRIBUTE_TYPES = ["text", "textarea", "select", "multiselect", "boolean"] as const;
export const ATTRIBUTE_GROUPS = ["details", "craft", "care"] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];
export type AttributeGroup = (typeof ATTRIBUTE_GROUPS)[number];

export type AttributeValue = { id: number; attribute_id: number; value: string; slug: string; sort_order: number };
export type Attribute = {
  id: number;
  name: string;
  code: string;
  type: AttributeType;
  group: AttributeGroup;
  is_filterable: boolean;
  is_visible: boolean;
  sort_order: number;
  values: AttributeValue[];
  category_ids: number[];
};

export type OptionValue = {
  id: number;
  product_option_id: number;
  label: string;
  code: string | null;
  hex: string | null;
  size_group: string | null;
  is_custom: boolean;
  sort_order: number;
};
export type ProductOption = { id: number; name: string; code: string; sort_order: number; values: OptionValue[] };

export type SizeChartTable = { columns: string[]; rows: string[][] };
export type SizeChart = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  unit: "in" | "cm";
  chart: SizeChartTable | null;
  measurement_guide: string | null;
  guide_media_id: number | null;
  guide_url: string | null;
};

/** Row shape of GET /admin/products (used for collection curation search). */
export type ProductListItem = { id: number; name: string; sku: string | null; status: string; thumb_url: string | null };
