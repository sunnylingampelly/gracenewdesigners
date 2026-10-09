import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { MediaImage } from "@/components/media/media-image";
import { PreviewBanner } from "@/components/store/preview-banner";
import { Breadcrumbs } from "@/components/store/ui";
import { api } from "@/lib/api-server";
import { previewToken } from "@/lib/preview";
import { formatDate, mediaUrl } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) return { page: null, token: null };
  const token = await previewToken();
  return { page: await api.page(slug, token), token };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await load(slug);
  if (!page) return { title: "Not found" };
  return {
    title: page.seo.title,
    description: page.seo.description ?? undefined,
    alternates: { canonical: page.seo.canonical_url },
    robots: page.seo.indexable ? undefined : { index: false, follow: true },
    openGraph: { title: page.title, images: page.hero ? [{ url: mediaUrl(page.hero, "lg")! }] : undefined },
  };
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  if (slug === "contact") permanentRedirect("/contact");
  const { page, token } = await load(slug);
  if (!page) notFound();

  const story = page.template === "story";

  return (
    <>
      {token && <PreviewBanner path={`/pages/${slug}`} />}
      {page.hero && (
        <div className="relative h-[55svh] min-h-80 overflow-hidden bg-ice">
          <MediaImage media={page.hero} sizes="100vw" fill priority />
        </div>
      )}
      <article className="container-editorial pt-10 pb-24 sm:pt-14">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: page.title }]} />
        <header className={story ? "mx-auto mt-10 max-w-3xl text-center" : "mt-8 max-w-3xl"}>
          <h1 className="display text-display text-midnight">{page.title}</h1>
          {page.excerpt && <p className={story ? "display mt-6 text-2xl text-ink/80 italic" : "mt-4 text-lg text-muted"}>{page.excerpt}</p>}
        </header>
        {page.body && <div className={story ? "prose-couture mx-auto mt-12" : "prose-couture mt-10"} dangerouslySetInnerHTML={{ __html: page.body }} />}
        {page.template === "policy" && page.updated_at && <p className="mt-12 text-xs text-muted">Last updated {formatDate(page.updated_at)}</p>}
      </article>
    </>
  );
}
