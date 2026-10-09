/** URL ⇄ API mapping for product listings. Only whitelisted keys are forwarded to the API. */

export const FILTER_KEYS = ["subcategory", "size", "color", "occasions", "collections", "price_min", "price_max", "availability", "fulfilment", "custom_size"] as const;
export const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "popular", label: "Most popular" },
  { value: "alphabetical", label: "Alphabetical" },
] as const;

export type SearchParamsInput = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Build the API query from page context + visitor-chosen filters. */
export function buildListingQuery(context: Record<string, string | undefined>, params: SearchParamsInput): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(context)) if (value) query.set(key, value);
  for (const key of FILTER_KEYS) {
    const value = first(params[key]);
    if (value) query.set(key, value.slice(0, 500));
  }
  for (const [key, value] of Object.entries(params)) {
    const match = key.match(/^attr\[([a-z0-9-]+)\]$/);
    const v = first(value);
    if (match && v) query.set(`attr[${match[1]}]`, v.slice(0, 500));
  }
  const sort = first(params.sort);
  if (sort && SORT_OPTIONS.some((o) => o.value === sort)) query.set("sort", sort);
  else if (context.sort) query.set("sort", context.sort);
  const page = Number(first(params.page));
  if (Number.isInteger(page) && page > 1 && page < 1000) query.set("page", String(page));
  query.set("per_page", "24");
  return query;
}

/** Facet query: same context and filters, without sort/page. */
export function facetQuery(query: URLSearchParams): URLSearchParams {
  const q = new URLSearchParams(query);
  q.delete("page");
  q.delete("per_page");
  q.delete("sort");
  return q;
}

/** Filtered or sorted variants of a listing are not indexed (avoids faceted duplicate pages). */
export function isRefined(params: SearchParamsInput): boolean {
  return Object.keys(params).some((key) => key !== "page" && (FILTER_KEYS.includes(key as (typeof FILTER_KEYS)[number]) || key === "sort" || key.startsWith("attr[")));
}

export function activeFilterCount(params: SearchParamsInput): number {
  let count = 0;
  for (const [key, value] of Object.entries(params)) {
    const v = first(value);
    if (!v) continue;
    if (key === "price_min" || key === "price_max") continue;
    if (FILTER_KEYS.includes(key as (typeof FILTER_KEYS)[number]) || key.startsWith("attr[")) count += v.split(",").length;
  }
  if (first(params.price_min) || first(params.price_max)) count += 1;
  return count;
}
