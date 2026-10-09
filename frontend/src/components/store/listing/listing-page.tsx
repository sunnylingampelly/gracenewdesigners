import Link from "next/link";
import { Suspense } from "react";
import { MediaImage } from "@/components/media/media-image";
import { api } from "@/lib/api-server";
import { activeFilterCount, buildListingQuery, facetQuery, type SearchParamsInput } from "@/lib/listing";
import type { Breadcrumb, ListingContext, Media } from "@/lib/types";
import { splitParagraphs } from "@/lib/utils";
import { ProductCard, ProductCardSkeleton } from "../product-card";
import { Breadcrumbs, ButtonLink, JsonLd } from "../ui";
import { ActiveFilterChips, FilterControls, ListingToolbar } from "./filter-panel";
import { ListTracker } from "./list-tracker";

type Header = {
  title: string;
  eyebrow?: string | null;
  intro?: string | null;
  banner?: Media | null;
  breadcrumbs?: { name: string; href?: string }[];
  children?: ListingContext["children"];
};

type Props = {
  header: Header;
  /** Fixed API filters for this page (e.g. { category: "women/lehengas" }). */
  context: Record<string, string | undefined>;
  searchParams: SearchParamsInput;
  basePath: string;
  listName: string;
  /** Facet groups that don't make sense on this page (e.g. "collections" on a collection page). */
  hideFacets?: string[];
};

export function ListingPage(props: Props) {
  const { header } = props;
  const crumbs = header.breadcrumbs ?? [];

  return (
    <>
      <ListingHeader header={header} />
      <div className="container-editorial pb-24">
        {header.children && header.children.length > 0 && (
          <nav aria-label="Subcategories" className="scrollbar-none -mx-[var(--spacing-gutter)] mb-2 flex gap-2 overflow-x-auto px-[var(--spacing-gutter)] pb-2">
            {header.children.map((child) => (
              <Link key={child.path} href={child.url} className="shrink-0 border border-line-strong px-4 py-2.5 text-[0.7rem] font-semibold tracking-[0.16em] whitespace-nowrap uppercase transition-colors hover:border-ink">
                {child.name}
              </Link>
            ))}
          </nav>
        )}
        <Suspense key={JSON.stringify(props.searchParams)} fallback={<ListingSkeleton />}>
          <ListingResults {...props} />
        </Suspense>
      </div>
      {crumbs.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [{ name: "Home", href: "/" }, ...crumbs].map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: c.name,
              item: c.href ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${c.href}` : undefined,
            })),
          }}
        />
      )}
    </>
  );
}

function ListingHeader({ header }: { header: Header }) {
  const intro = splitParagraphs(header.intro);
  if (header.banner) {
    return (
      <header className="relative isolate mb-8 flex min-h-[42svh] items-end overflow-hidden bg-midnight text-ivory sm:min-h-[52svh]" data-theme="dark-section">
        <MediaImage media={header.banner} sizes="100vw" fill priority />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-midnight/85 via-midnight/25 to-transparent" />
        <div className="container-editorial relative py-10 sm:py-14">
          {header.breadcrumbs && <div className="mb-5 [&_*]:!text-ivory/80"><Breadcrumbs items={[{ name: "Home", href: "/" }, ...header.breadcrumbs]} /></div>}
          {header.eyebrow && <p className="eyebrow mb-3 text-sky">{header.eyebrow}</p>}
          <h1 className="display text-display">{header.title}</h1>
          {intro.length > 0 && <div className="mt-4 max-w-2xl space-y-3 text-[0.98rem] leading-relaxed text-ivory/85">{intro.map((p) => <p key={p}>{p}</p>)}</div>}
        </div>
      </header>
    );
  }
  return (
    <header className="container-editorial pt-10 pb-6 sm:pt-14">
      {header.breadcrumbs && <Breadcrumbs items={[{ name: "Home", href: "/" }, ...header.breadcrumbs]} />}
      {header.eyebrow && <p className="eyebrow mt-6 text-royal">{header.eyebrow}</p>}
      <h1 className="display mt-3 text-display text-midnight">{header.title}</h1>
      {intro.length > 0 && <div className="mt-4 max-w-2xl space-y-3 leading-relaxed text-ink/80">{intro.map((p) => <p key={p}>{p}</p>)}</div>}
    </header>
  );
}

async function ListingResults({ context, searchParams, basePath, listName, hideFacets = [] }: Props) {
  const query = buildListingQuery(context, searchParams);
  const [results, facets] = await Promise.all([api.products(query), api.facets(facetQuery(query))]);
  const active = activeFilterCount(searchParams);
  const { current_page: page, last_page: lastPage, total } = results.meta;

  return (
    <>
      <ListingToolbar total={total} facets={facets} activeCount={active} hide={hideFacets} />
      <ActiveFilterChips facets={facets} />
      <div className="grid gap-10 pt-4 lg:grid-cols-[15rem_1fr] xl:grid-cols-[16.5rem_1fr]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-36">
            <FilterControls facets={facets} hide={hideFacets} />
          </div>
        </aside>
        <div>
          {results.data.length === 0 ? (
            <EmptyState refined={active > 0} basePath={basePath} />
          ) : (
            <>
              <ListTracker listName={listName} count={results.data.length} />
              <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 xl:gap-x-8">
                {results.data.map((product, i) => (
                  <li key={product.id}>
                    <ProductCard product={product} listName={listName} index={i} priority={page === 1 && i < 3} sizes="(min-width: 1280px) 26vw, (min-width: 768px) 30vw, 50vw" />
                  </li>
                ))}
              </ul>
              {lastPage > 1 && <Pagination page={page} lastPage={lastPage} basePath={basePath} searchParams={searchParams} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Pagination({ page, lastPage, basePath, searchParams }: { page: number; lastPage: number; basePath: string; searchParams: SearchParamsInput }) {
  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && k !== "page") params.set(k, v);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const pages = [...new Set([1, page - 1, page, page + 1, lastPage].filter((p) => p >= 1 && p <= lastPage))].sort((a, b) => a - b);

  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-1">
      {page > 1 && <Link href={href(page - 1)} rel="prev" className="min-h-11 px-4 py-3 text-[0.7rem] font-semibold tracking-[0.16em] uppercase">Previous</Link>}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - pages[i - 1] > 1 && <span className="px-2 text-muted">…</span>}
          <Link href={href(p)} aria-current={p === page ? "page" : undefined} className={p === page ? "flex h-11 w-11 items-center justify-center bg-midnight text-sm text-ivory" : "flex h-11 w-11 items-center justify-center text-sm hover:bg-paper"}>
            {p}
          </Link>
        </span>
      ))}
      {page < lastPage && <Link href={href(page + 1)} rel="next" className="min-h-11 px-4 py-3 text-[0.7rem] font-semibold tracking-[0.16em] uppercase">Next</Link>}
    </nav>
  );
}

function EmptyState({ refined, basePath }: { refined: boolean; basePath: string }) {
  return (
    <div className="flex flex-col items-center border border-dashed border-line-strong px-6 py-20 text-center">
      <p className="display text-3xl text-midnight">{refined ? "No designs match these filters" : "New designs are on their way"}</p>
      <p className="mt-3 max-w-md text-muted">
        {refined ? "Try removing a filter or two to see more of the collection." : "This edit is being prepared. Explore our other collections in the meantime, or speak with our team."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {refined && <ButtonLink href={basePath} variant="outline">Clear filters</ButtonLink>}
        <ButtonLink href="/shop">Browse all designs</ButtonLink>
      </div>
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading designs">
      <div className="flex justify-between border-b border-line py-4">
        <div className="skeleton h-5 w-28" />
        <div className="skeleton h-5 w-36" />
      </div>
      <div className="grid gap-10 pt-8 lg:grid-cols-[15rem_1fr] xl:grid-cols-[16.5rem_1fr]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10" />)}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}

export function crumbsFrom(breadcrumbs: Breadcrumb[] | undefined, prefix = "/shop/"): { name: string; href: string }[] {
  return (breadcrumbs ?? []).map((b) => ({ name: b.name, href: prefix + b.path }));
}
