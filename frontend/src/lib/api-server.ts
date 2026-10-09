/**
 * Server-side API access for storefront Server Components.
 * Uses the internal API origin and Next's fetch cache (ISR) with tags for on-demand revalidation.
 */
import type {
  CategoryTree,
  CmsPage,
  CollectionSummary,
  Facets,
  HomepageSection,
  ListingContext,
  Lookbook,
  LookbookSummary,
  Navigation,
  OccasionSummary,
  Paginated,
  ProductCard,
  ProductDetail,
  PublicSettings,
} from "./types";

const API = `${(process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8010").replace(/\/$/, "")}/api/v1`;
const REVALIDATE = Number(process.env.CATALOG_REVALIDATE_SECONDS ?? 60);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type FetchOptions = { tags?: string[]; revalidate?: number | false; previewToken?: string | null };

/** Returns parsed JSON, `null` for 404, and `{ gone: true }` for 410. Throws on other failures. */
async function request<T>(path: string, { tags = [], revalidate = REVALIDATE, previewToken }: FetchOptions = {}): Promise<T | null | { gone: true }> {
  const url = new URL(API + path);
  if (previewToken) url.searchParams.set("preview_token", previewToken);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      ...(previewToken ? { cache: "no-store" as const } : { next: { revalidate: revalidate === false ? false : revalidate, tags: ["catalog", ...tags] } }),
    });
  } catch (error) {
    throw new ApiError(503, `The catalogue service is unreachable (${(error as Error).message}).`);
  }

  if (res.status === 404) return null;
  if (res.status === 410) return { gone: true };
  if (!res.ok) throw new ApiError(res.status, `API ${res.status} for ${path}`);
  return (await res.json()) as T;
}

function isGone(value: unknown): value is { gone: true } {
  return typeof value === "object" && value !== null && "gone" in value;
}

async function data<T>(path: string, options?: FetchOptions): Promise<T | null> {
  const result = await request<{ data: T }>(path, options);
  if (result === null || isGone(result)) return null;
  return result.data;
}

export const api = {
  settings: async () => (await data<PublicSettings>("/settings/public", { tags: ["settings"] }))!,
  navigation: async () => (await data<Navigation>("/navigation", { tags: ["navigation"] })) ?? {},
  homepage: (previewToken?: string | null) => data<HomepageSection[]>("/homepage", { tags: ["homepage"], previewToken }),
  footerPages: () => data<{ label: string; url: string }[]>("/pages", { tags: ["pages"] }),
  page: (slug: string, previewToken?: string | null) => data<CmsPage>(`/pages/${encodeURIComponent(slug)}`, { tags: ["pages"], previewToken }),

  categoryTree: async () => (await data<CategoryTree>("/categories", { tags: ["taxonomy"] })) ?? [],
  department: (slug: string) => data<ListingContext>(`/departments/${encodeURIComponent(slug)}`, { tags: ["taxonomy"] }),
  category: (path: string) => data<ListingContext>(`/categories/${path.split("/").map(encodeURIComponent).join("/")}`, { tags: ["taxonomy"] }),
  collections: async () => (await data<CollectionSummary[]>("/collections", { tags: ["taxonomy"] })) ?? [],
  collection: (slug: string) => data<ListingContext>(`/collections/${encodeURIComponent(slug)}`, { tags: ["taxonomy"] }),
  occasions: async () => (await data<OccasionSummary[]>("/occasions", { tags: ["taxonomy"] })) ?? [],
  occasion: (slug: string) => data<ListingContext>(`/occasions/${encodeURIComponent(slug)}`, { tags: ["taxonomy"] }),
  lookbooks: async () => (await data<LookbookSummary[]>("/lookbooks", { tags: ["content"] })) ?? [],
  lookbook: (slug: string) => data<Lookbook>(`/lookbooks/${encodeURIComponent(slug)}`, { tags: ["content"] }),

  products: async (query: URLSearchParams) =>
    (await request<Paginated<ProductCard>>(`/products?${query.toString()}`, { tags: ["products"] })) as Paginated<ProductCard>,
  facets: async (query: URLSearchParams) => (await data<Facets>(`/products/facets?${query.toString()}`, { tags: ["products"] }))!,

  /** Product detail: `null` when it never existed, `"gone"` when archived/removed (HTTP 410). */
  product: async (slug: string, previewToken?: string | null): Promise<ProductDetail | null | "gone"> => {
    const result = await request<{ data: ProductDetail }>(`/products/${encodeURIComponent(slug)}`, { tags: ["products", `product:${slug}`], previewToken });
    if (result === null) return null;
    if (isGone(result)) return "gone";
    return result.data;
  },

  search: async (query: URLSearchParams) =>
    (await request<Paginated<ProductCard> & { meta: { query: string; corrected_query: string | null; recommendations?: ProductCard[] } }>(
      `/search?${query.toString()}`,
      { revalidate: 30, tags: ["products"] },
    )) as Paginated<ProductCard> & { meta: Paginated<ProductCard>["meta"] & { query: string; corrected_query: string | null; recommendations?: ProductCard[] } },

  sitemap: async () => (await data<{ path: string; updated_at: string | null }[]>("/sitemap", { revalidate: 3600, tags: ["sitemap"] })) ?? [],

  resolveRedirect: (path: string) =>
    data<{ to: string | null; status: number } | null>(`/redirects/resolve?path=${encodeURIComponent(path)}`, { revalidate: 300, tags: ["redirects"] }),
};

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
