import type { Metadata } from "next";
import Link from "next/link";
import { MediaImage } from "@/components/media/media-image";
import { Breadcrumbs } from "@/components/store/ui";
import { api } from "@/lib/api-server";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Shop by Occasion",
  description: "Wedding, reception, sangeet, mehendi and festive edits.",
  alternates: { canonical: absoluteUrl("/occasions") },
};

export default async function OccasionsPage() {
  const occasions = await api.occasions();
  return (
    <div className="container-editorial pt-10 pb-24 sm:pt-14">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Occasions" }]} />
      <h1 className="display mt-6 text-display text-midnight">Shop by Occasion</h1>
      <p className="mt-4 max-w-xl text-muted">Dressed for every moment — from the first ceremony to the last dance.</p>
      <ul className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {occasions.map((o) => (
          <li key={o.slug}>
            <Link href={o.url} className="group relative block aspect-[3/4] overflow-hidden bg-navy">
              <MediaImage media={o.image} sizes="(min-width: 1024px) 25vw, 50vw" fill alt="" className="opacity-85 transition-transform duration-[1.2s] group-hover:scale-[1.04]" />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-midnight/80 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-5 text-ivory">
                <span className="display block text-3xl">{o.name}</span>
                {o.description && <span className="mt-2 hidden text-sm text-ivory/80 sm:block">{o.description}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
