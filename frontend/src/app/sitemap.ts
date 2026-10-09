import type { MetadataRoute } from "next";
import { api, siteUrl } from "@/lib/api-server";

export const revalidate = 3600;

const STATIC_PATHS = ["/", "/shop", "/new-arrivals", "/collections", "/occasions", "/lookbook", "/contact", "/book-consultation"];

/** Only published, indexable URLs; filtered listing variants are deliberately excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let dynamic: { path: string; updated_at: string | null }[] = [];
  try {
    dynamic = await api.sitemap();
  } catch {
    dynamic = [];
  }
  const departments = await api.categoryTree().catch(() => []);

  return [
    ...STATIC_PATHS.map((path) => ({ url: `${siteUrl}${path}`, changeFrequency: "weekly" as const, priority: path === "/" ? 1 : 0.7 })),
    ...departments.map((d) => ({ url: `${siteUrl}/shop/${d.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...dynamic.map((entry) => ({
      url: `${siteUrl}${entry.path}`,
      lastModified: entry.updated_at ?? undefined,
      changeFrequency: entry.path.startsWith("/products/") ? ("weekly" as const) : ("monthly" as const),
      priority: entry.path.startsWith("/products/") ? 0.6 : 0.7,
    })),
  ];
}
