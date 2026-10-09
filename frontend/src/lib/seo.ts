import type { Metadata } from "next";
import { isRefined, type SearchParamsInput } from "./listing";
import { absoluteUrl } from "./utils";

/**
 * Listing metadata: canonical always points at the unfiltered page (keeping ?page for deep pages),
 * and refined/sorted variants are `noindex, follow` to avoid faceted duplicate content.
 */
export function listingMetadata({
  title,
  description,
  path,
  searchParams,
  image,
}: {
  title: string;
  description?: string | null;
  path: string;
  searchParams: SearchParamsInput;
  image?: string | null;
}): Metadata {
  const page = Number(Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page);
  const canonicalPath = Number.isInteger(page) && page > 1 && !isRefined(searchParams) ? `${path}?page=${page}` : path;

  return {
    title: page > 1 ? `${title} — Page ${page}` : title,
    description: description ?? undefined,
    alternates: { canonical: absoluteUrl(canonicalPath) },
    robots: isRefined(searchParams) ? { index: false, follow: true } : undefined,
    openGraph: { title, description: description ?? undefined, url: absoluteUrl(path), images: image ? [{ url: image }] : undefined },
  };
}
