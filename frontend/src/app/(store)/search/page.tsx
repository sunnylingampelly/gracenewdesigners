import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListingSkeleton } from "@/components/store/listing/listing-page";
import { ListTracker } from "@/components/store/listing/list-tracker";
import { ProductCard } from "@/components/store/product-card";
import { Breadcrumbs, ButtonLink } from "@/components/store/ui";
import { api } from "@/lib/api-server";
import type { SearchParamsInput } from "@/lib/listing";

type Props = { searchParams: Promise<SearchParamsInput> };

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q).trim().slice(0, 100);

  return (
    <div className="container-editorial pt-10 pb-24 sm:pt-14">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Search" }]} />
      <form action="/search" role="search" className="mt-8 flex max-w-2xl items-end gap-4 border-b border-ink/40">
        <label className="flex-1">
          <span className="eyebrow block text-muted">Search the collection</span>
          <input name="q" type="search" defaultValue={q} minLength={2} maxLength={100} required className="display w-full bg-transparent py-3 text-3xl focus:outline-none sm:text-5xl" />
        </label>
        <button type="submit" className="pb-4 text-[0.7rem] font-semibold tracking-[0.2em] text-royal uppercase">Search</button>
      </form>
      {q.length >= 2 ? (
        <Suspense key={q + first(params.page)} fallback={<div className="mt-10"><ListingSkeleton /></div>}>
          <Results q={q} page={first(params.page)} />
        </Suspense>
      ) : (
        <p className="mt-10 text-muted">Enter at least two characters to search.</p>
      )}
    </div>
  );
}

async function Results({ q, page }: { q: string; page: string }) {
  const query = new URLSearchParams({ q });
  if (Number(page) > 1) query.set("page", page);
  const results = await api.search(query);
  const { meta } = results;

  return (
    <div className="mt-10">
      <p className="text-sm text-muted" aria-live="polite">
        {meta.total} {meta.total === 1 ? "result" : "results"} for <span className="text-ink">“{meta.corrected_query ?? q}”</span>
        {meta.corrected_query && <span> — showing results for “{meta.corrected_query}” instead of “{q}”</span>}
      </p>

      {results.data.length > 0 ? (
        <>
          <ListTracker listName={`search:${q}`} count={results.data.length} />
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
            {results.data.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} listName="search" index={i} priority={i < 4} />
              </li>
            ))}
          </ul>
          {meta.last_page > 1 && (
            <nav aria-label="Pagination" className="mt-14 flex justify-center gap-6 text-[0.7rem] font-semibold tracking-[0.16em] uppercase">
              {meta.current_page > 1 && <Link href={`/search?q=${encodeURIComponent(q)}&page=${meta.current_page - 1}`}>Previous</Link>}
              <span className="text-muted">Page {meta.current_page} of {meta.last_page}</span>
              {meta.current_page < meta.last_page && <Link href={`/search?q=${encodeURIComponent(q)}&page=${meta.current_page + 1}`}>Next</Link>}
            </nav>
          )}
        </>
      ) : (
        <div className="mt-10">
          <div className="border border-dashed border-line-strong px-6 py-14 text-center">
            <p className="display text-3xl text-midnight">Nothing matched “{q}”</p>
            <p className="mt-3 text-muted">Try a different spelling or a broader word such as “lehenga” or “saree”.</p>
            <div className="mt-8 flex justify-center gap-3">
              <ButtonLink href="/shop">Browse all designs</ButtonLink>
              <ButtonLink href="/contact" variant="outline">Ask our team</ButtonLink>
            </div>
          </div>
          {meta.recommendations && meta.recommendations.length > 0 && (
            <section className="mt-16">
              <h2 className="display text-display-sm text-midnight">You may love</h2>
              <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-4">
                {meta.recommendations.slice(0, 4).map((p, i) => (
                  <li key={p.id}><ProductCard product={p} listName="search:no-results" index={i} /></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
