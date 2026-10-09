import type { Metadata } from "next";
import Link from "next/link";
import { MediaImage } from "@/components/media/media-image";
import { Breadcrumbs } from "@/components/store/ui";
import { api } from "@/lib/api-server";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Collections",
  description: "Curated edits and signature collections from the studio.",
  alternates: { canonical: absoluteUrl("/collections") },
};

export default async function CollectionsPage() {
  const collections = await api.collections();
  const [lead, ...rest] = collections;

  return (
    <div className="container-editorial pt-10 pb-24 sm:pt-14">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Collections" }]} />
      <h1 className="display mt-6 text-display text-midnight">Collections</h1>
      <p className="mt-4 max-w-xl text-muted">Curated edits, each with its own story — explore by mood, season and moment.</p>

      {collections.length === 0 ? (
        <p className="mt-16 text-muted">New collections are being prepared.</p>
      ) : (
        <>
          {lead && (
            <Link href={lead.url} className="group mt-12 grid overflow-hidden bg-midnight text-ivory lg:grid-cols-[1.4fr_1fr]">
              <div className="relative aspect-[4/5] lg:aspect-auto lg:min-h-[70svh]">
                <MediaImage media={lead.cover} sizes="(min-width: 1024px) 60vw, 100vw" fill priority className="transition-transform duration-[1.4s] group-hover:scale-[1.03]" />
              </div>
              <div className="flex flex-col justify-end p-8 sm:p-14">
                <p className="eyebrow text-sky">{lead.is_featured ? "Featured Collection" : "Collection"}</p>
                <h2 className="display mt-4 text-display">{lead.name}</h2>
                {lead.tagline && <p className="mt-4 text-ivory/80">{lead.tagline}</p>}
                <span className="mt-8 text-[0.7rem] font-semibold tracking-[0.2em] uppercase">Discover {lead.product_count} designs →</span>
              </div>
            </Link>
          )}
          <ul className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((c) => (
              <li key={c.slug}>
                <Link href={c.url} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-ice">
                    <MediaImage media={c.cover} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" fill className="transition-transform duration-[1.2s] group-hover:scale-[1.03]" />
                  </div>
                  <h2 className="display mt-5 text-3xl">{c.name}</h2>
                  {c.tagline && <p className="mt-2 text-sm text-muted">{c.tagline}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
