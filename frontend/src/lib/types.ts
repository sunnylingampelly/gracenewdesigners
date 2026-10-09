/** Types mirroring the Laravel storefront API resources (api/v1). */

export type MediaSource = {
  name: string;
  url: string;
  width: number | null;
  height: number | null;
  format: string | null;
};

export type Media = {
  id: number;
  kind: "image" | "video" | "document";
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
  mime_type: string;
  focal_point: { x: number; y: number } | null;
  sources: MediaSource[];
};

export type PriceMode = "fixed" | "starting_from" | "on_request";

export type Pricing = {
  price_mode: PriceMode;
  price: number | null;
  compare_at_price: number | null;
  currency: string;
  price_label: string;
  cta_label: string;
};

export type ProductCard = Pricing & {
  id: number;
  slug: string;
  name: string;
  url: string;
  category: string | null;
  badges: string[];
  image: Media | null;
  hover_image: Media | null;
  colors: { code: string; label: string; hex: string | null }[];
  is_available: boolean;
  allows_custom_size: boolean;
};

export type Availability = "in_stock" | "low_stock" | "made_to_order" | "out_of_stock";

export type Variant = {
  id: number;
  sku: string;
  size_id: number | null;
  color_id: number | null;
  price: number | null;
  price_label: string | null;
  compare_at_price: number | null;
  availability: Availability;
  availability_label: string;
  is_enquirable: boolean;
  image: Media | null;
};

export type Breadcrumb = { name: string; path: string };

export type SizeChart = {
  name: string;
  unit: string;
  description: string | null;
  chart: { columns: string[]; rows: string[][] } | null;
  measurement_guide: string | null;
  guide_url: string | null;
};

export type ProductDetail = Pricing & {
  id: number;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  url: string;
  short_description: string | null;
  description: string | null;
  badges: string[];
  department: { name: string; slug: string } | null;
  category: { name: string; path: string } | null;
  breadcrumbs: Breadcrumb[];
  collections: { name: string; slug: string }[];
  occasions: { name: string; slug: string }[];
  tags: string[];
  gallery: { id: number; role: string; color_code: string | null; media: Media }[];
  options: {
    sizes: { id: number; code: string; label: string; group: string | null }[];
    colors: { id: number; code: string; label: string; hex: string | null }[];
  };
  variants: Variant[];
  allows_custom_size: boolean;
  is_made_to_order: boolean;
  lead_time: string | null;
  set_includes: string | null;
  craftsmanship: string | null;
  care_instructions: string | null;
  delivery_notes: string | null;
  country_of_origin: string | null;
  tax_note: string | null;
  attributes: { code: string; name: string; group: string; value: string }[];
  size_chart: SizeChart | null;
  related: ProductCard[];
  complete_the_look: ProductCard[];
  published_at: string | null;
  seo: { title: string; description: string | null; canonical_url: string; og_image: string | null; indexable: boolean };
};

export type Paginated<T> = {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null };
  links?: unknown;
};

export type FacetValue = { value: string; label: string; count: number; hex?: string };

export type Facets = {
  subcategories: FacetValue[];
  sizes: FacetValue[];
  colors: FacetValue[];
  attributes: { code: string; name: string; values: FacetValue[] }[];
  occasions: FacetValue[];
  collections: FacetValue[];
  price: { min: number | null; max: number | null };
};

export type Seo = { title: string; description: string | null; canonical_url: string; indexable?: boolean };

export type ListingContext = {
  type: "department" | "category" | "collection" | "occasion";
  name: string;
  slug: string;
  path?: string;
  intro?: string | null;
  story?: string | null;
  tagline?: string | null;
  description?: string | null;
  banner: Media | null;
  cover?: Media | null;
  breadcrumbs?: Breadcrumb[];
  children?: { name: string; path: string; url: string; image: Media | null }[];
  seo: Seo;
};

export type NavItem = {
  id: number;
  label: string;
  url: string | null;
  group: string | null;
  highlight: string | null;
  external: boolean;
  image: Media | null;
  children: NavItem[];
};

export type Navigation = Partial<Record<"header" | "footer_shop" | "footer_house" | "footer_help" | "mobile_secondary", NavItem[]>>;

export type PublicSettings = {
  brand_name: string;
  tagline: string | null;
  brand_description: string | null;
  brand_colors: Record<string, string> | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  business_hours: string | null;
  map_url: string | null;
  whatsapp_business_number: string | null;
  whatsapp_enabled: boolean;
  whatsapp_available: boolean;
  social_instagram: string | null;
  social_facebook: string | null;
  social_pinterest: string | null;
  social_youtube: string | null;
  social_x: string | null;
  site_url: string | null;
  currency: string;
  timezone: string;
  announcement_enabled: boolean;
  announcement_text: string | null;
  announcement_link: string | null;
  newsletter_enabled: boolean;
  consultation_enabled: boolean;
  shipping_note: string | null;
  seo_title_suffix: string | null;
  seo_default_description: string | null;
  google_site_verification: string | null;
  ga4_measurement_id: string | null;
  logo_primary: Media | null;
  logo_dark_bg: Media | null;
  logo_light_bg: Media | null;
  logo_mobile: Media | null;
  favicon: Media | null;
  social_share: Media | null;
};

export type HomepageSection = { id: number; type: string; data: Record<string, unknown> };

export type CmsPage = {
  title: string;
  slug: string;
  template: "default" | "story" | "policy" | "contact";
  excerpt: string | null;
  body: string | null;
  hero: Media | null;
  updated_at: string | null;
  seo: Seo & { indexable: boolean };
};

export type LookbookSummary = { title: string; slug: string; url: string; season: string | null; description: string | null; cover: Media | null };

export type Lookbook = LookbookSummary & {
  collection: { name: string; url: string } | null;
  items: {
    media: Media;
    caption: string | null;
    layout: "portrait" | "landscape" | "full";
    product: { name: string; url: string } | null;
    collection: { name: string; url: string } | null;
  }[];
  seo: Seo;
};

export type CategoryNode = { id: number; name: string; path: string; url: string; image: Media | null; children: CategoryNode[] };

export type CategoryTree = { name: string; slug: string; url: string; categories: CategoryNode[] }[];

export type CollectionSummary = {
  name: string;
  slug: string;
  url: string;
  tagline: string | null;
  is_featured: boolean;
  cover: Media | null;
  product_count: number;
};

export type OccasionSummary = { name: string; slug: string; url: string; description: string | null; image: Media | null };

export type EnquiryResult = {
  reference: string;
  status: "initiated";
  whatsapp_url: string | null;
  message: string;
  summary_url: string;
  summary_token: string;
};

export type EnquirySummary = {
  reference: string;
  created_at: string;
  items: { product_name: string; reference: string; size: string | null; color: string | null; quantity: number; price_label: string | null; url: string | null }[];
  display_total: string | null;
  whatsapp_url: string | null;
};

export type SearchSuggestions = {
  products: ProductCard[];
  categories: { label: string; url: string; context: string }[];
  collections: { label: string; url: string }[];
  corrected_query: string | null;
};
