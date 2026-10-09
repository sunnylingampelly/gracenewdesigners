import type { Metadata } from "next";
import Link from "next/link";
import { MediaImage } from "@/components/media/media-image";
import { Breadcrumbs } from "@/components/store/ui";
import { api } from "@/lib/api-server";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "Lookbook", description: "Campaign stories from the studio.", alternates: { canonical: absoluteUrl("/lookbook") } };

export default async function LookbookIndex() {
  const lookbooks = await api.lookbooks();
  return (
    <div className="container-editorial pt-10 pb-24 sm:pt-14">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Lookbook" }]} />
      <h1 className="display mt-6 text-display text-midnight">Lookbook</h1>
      {lookbooks.length === 0 ? (
        <p className="mt-10 text-muted">Our next campaign is in the making.</p>
      ) : (
        <ul className="mt-12 grid gap-14">
          {lookbooks.map((l, i) => (
            <li key={l.slug}>
              <Link href={l.url} className="group grid items-end gap-8 lg:grid-cols-[1.6fr_1fr]">
                <div className="relative aspect-[16/9] overflow-hidden bg-ice">
                  <MediaImage media={l.cover} sizes="(min-width: 1024px) 60vw, 100vw" fill priority={i === 0} className="transition-transform duration-[1.4s] group-hover:scale-[1.02]" />
                </div>
                <div>
                  {l.season && <p className="eyebrow text-royal">{l.season}</p>}
                  <h2 className="display mt-3 text-display">{l.title}</h2>
                  {l.description && <p className="mt-4 text-muted">{l.description}</p>}
                  <span className="mt-6 inline-block text-[0.7rem] font-semibold tracking-[0.2em] text-royal uppercase">View the story →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
