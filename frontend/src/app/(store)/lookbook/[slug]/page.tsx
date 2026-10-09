import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaImage } from "@/components/media/media-image";
import { Breadcrumbs, ButtonLink } from "@/components/store/ui";
import { api } from "@/lib/api-server";
import { cn, mediaUrl } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const lookbook = await api.lookbook(slug);
  if (!lookbook) return { title: "Not found" };
  return {
    title: lookbook.seo.title,
    description: lookbook.seo.description ?? undefined,
    alternates: { canonical: lookbook.seo.canonical_url },
    openGraph: { images: lookbook.cover ? [{ url: mediaUrl(lookbook.cover, "lg")! }] : undefined },
  };
}

export default async function LookbookPage({ params }: Props) {
  const { slug } = await params;
  const lookbook = await api.lookbook(slug);
  if (!lookbook) notFound();

  return (
    <>
      <header className="relative isolate flex min-h-[70svh] items-end overflow-hidden bg-midnight text-ivory" data-theme="dark-section">
        <MediaImage media={lookbook.cover} sizes="100vw" fill priority />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-midnight/80 to-transparent" />
        <div className="container-editorial relative pb-14">
          {lookbook.season && <p className="eyebrow text-sky">{lookbook.season}</p>}
          <h1 className="display mt-3 text-display-lg">{lookbook.title}</h1>
          {lookbook.description && <p className="mt-5 max-w-xl text-ivory/85">{lookbook.description}</p>}
        </div>
      </header>
      <div className="container-editorial py-14">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Lookbook", href: "/lookbook" }, { name: lookbook.title }]} />
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-10">
          {lookbook.items.map((item, i) => (
            <figure key={i} className={cn(item.layout === "landscape" || item.layout === "full" ? "sm:col-span-2" : "")}>
              <div className={cn("relative overflow-hidden bg-ice", item.layout === "portrait" ? "aspect-[4/5]" : "aspect-[16/9]")}>
                <MediaImage media={item.media} sizes={item.layout === "portrait" ? "(min-width: 640px) 50vw, 100vw" : "100vw"} fill />
              </div>
              {(item.caption || item.product || item.collection) && (
                <figcaption className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
                  {item.caption && <span className="display text-xl">{item.caption}</span>}
                  {item.product && <Link href={item.product.url} className="text-[0.7rem] font-semibold tracking-[0.18em] text-royal uppercase">Shop the look →</Link>}
                  {!item.product && item.collection && <Link href={item.collection.url} className="text-[0.7rem] font-semibold tracking-[0.18em] text-royal uppercase">Explore {item.collection.name} →</Link>}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
        {lookbook.collection && (
          <div className="mt-20 text-center">
            <ButtonLink href={lookbook.collection.url}>Shop {lookbook.collection.name}</ButtonLink>
          </div>
        )}
      </div>
    </>
  );
}
