import * as Accordion from "@radix-ui/react-accordion";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/store/product-card";
import { ProductView } from "@/components/store/product/product-view";
import { PreviewBanner } from "@/components/store/preview-banner";
import { Breadcrumbs, JsonLd, SectionHeading } from "@/components/store/ui";
import { api, siteUrl } from "@/lib/api-server";
import { previewToken } from "@/lib/preview";
import type { ProductDetail } from "@/lib/types";
import { mediaUrl, splitParagraphs } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) return { product: null, token: null };
  const token = await previewToken();
  const product = await api.product(slug, token);
  return { product: product === "gone" ? null : product, token };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { product } = await load(slug);
  if (!product) return { title: "Not found", robots: { index: false } };

  const image = product.seo.og_image ?? mediaUrl(product.gallery[0]?.media, "lg");
  return {
    title: product.seo.title,
    description: product.seo.description ?? undefined,
    alternates: { canonical: product.seo.canonical_url },
    robots: product.seo.indexable ? undefined : { index: false, follow: true },
    openGraph: { type: "website", title: product.name, description: product.seo.description ?? undefined, url: product.seo.canonical_url, images: image ? [{ url: image, alt: product.name }] : undefined },
    twitter: { card: "summary_large_image", title: product.name, images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const { product, token } = await load(slug);
  if (!product) notFound();

  const crumbs = [
    { name: "Home", href: "/" },
    ...(product.department ? [{ name: product.department.name, href: `/shop/${product.department.slug}` }] : []),
    ...product.breadcrumbs.map((b) => ({ name: b.name, href: `/shop/${b.path}` })),
    { name: product.name },
  ];

  return (
    <>
      {token && <PreviewBanner path={`/products/${product.slug}`} />}
      <div className="container-editorial pt-6 pb-20 sm:pt-8">
        <div className="mb-6"><Breadcrumbs items={crumbs} /></div>
        <ProductView product={product} />
        <ProductDetails product={product} />
      </div>

      {product.complete_the_look.length > 0 && (
        <section className="bg-paper py-[var(--spacing-section)]">
          <div className="container-editorial">
            <SectionHeading eyebrow="Style it with" title="Complete the Look" align="left" />
            <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-6">
              {product.complete_the_look.slice(0, 4).map((p, i) => (
                <li key={p.id}><ProductCard product={p} listName="complete-the-look" index={i} sizes="(min-width: 768px) 25vw, 50vw" /></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {product.related.length > 0 && (
        <section className="py-[var(--spacing-section)]">
          <div className="container-editorial">
            <SectionHeading eyebrow="You may also love" title="Related Designs" align="left" />
            <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-6">
              {product.related.slice(0, 4).map((p, i) => (
                <li key={p.id}><ProductCard product={p} listName="related" index={i} sizes="(min-width: 768px) 25vw, 50vw" /></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <JsonLd data={productJsonLd(product)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.href ? `${siteUrl}${c.href}` : product.seo.canonical_url })),
        }}
      />
    </>
  );
}

function ProductDetails({ product }: { product: ProductDetail }) {
  const details = product.attributes.filter((a) => a.group === "details");
  const craft = product.attributes.filter((a) => a.group === "craft");
  const sections = [
    {
      id: "description",
      title: "Description",
      body: (
        <>
          {product.description && <div className="prose-couture" dangerouslySetInnerHTML={{ __html: product.description }} />}
          {(details.length > 0 || product.set_includes || product.country_of_origin) && (
            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
              {product.set_includes && <><dt className="text-muted">Set includes</dt><dd>{product.set_includes}</dd></>}
              {details.map((a) => <Row key={a.code} label={a.name} value={a.value} />)}
              {product.country_of_origin && <><dt className="text-muted">Made in</dt><dd>{product.country_of_origin}</dd></>}
              <dt className="text-muted">Design reference</dt><dd>{product.sku}</dd>
            </dl>
          )}
        </>
      ),
    },
    (product.craftsmanship || craft.length > 0) && {
      id: "craft",
      title: "Fabric & Craftsmanship",
      body: (
        <>
          {splitParagraphs(product.craftsmanship).map((p) => <p key={p} className="mb-3 leading-relaxed">{p}</p>)}
          {craft.length > 0 && <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">{craft.map((a) => <Row key={a.code} label={a.name} value={a.value} />)}</dl>}
        </>
      ),
    },
    product.care_instructions && { id: "care", title: "Care", body: splitParagraphs(product.care_instructions).map((p) => <p key={p} className="mb-3 leading-relaxed">{p}</p>) },
    (product.delivery_notes || product.lead_time) && {
      id: "delivery",
      title: "Delivery & Made to Order",
      body: (
        <>
          {product.lead_time && <p className="mb-3">{product.is_made_to_order ? "Crafted to order. " : ""}Estimated production: {product.lead_time}.</p>}
          {splitParagraphs(product.delivery_notes).map((p) => <p key={p} className="mb-3 leading-relaxed">{p}</p>)}
        </>
      ),
    },
  ].filter(Boolean) as { id: string; title: string; body: React.ReactNode }[];

  return (
    <section aria-label="Product details" className="mt-16 grid gap-10 lg:mt-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 xl:gap-24">
      <div className="hidden lg:block">
        {product.occasions.length > 0 && (
          <div>
            <p className="eyebrow text-muted">Made for</p>
            <p className="display mt-3 text-3xl text-midnight">{product.occasions.map((o) => o.name).join(" · ")}</p>
          </div>
        )}
      </div>
      <Accordion.Root type="multiple" defaultValue={["description"]} className="divide-y divide-line border-y border-line">
        {sections.map((s) => (
          <Accordion.Item key={s.id} value={s.id}>
            <Accordion.Header>
              <Accordion.Trigger className="group flex min-h-14 w-full items-center justify-between text-left text-[0.72rem] font-semibold tracking-[0.18em] uppercase">
                {s.title}
                <span aria-hidden className="text-lg font-light transition-transform group-data-[state=open]:rotate-45">+</span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="pb-8 text-[0.95rem] text-ink/85">{s.body}</Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

/** Product structured data. Prices/availability are only included when they are real and public. */
function productJsonLd(product: ProductDetail) {
  const enquirable = product.variants.filter((v) => v.is_enquirable);
  const availability = product.variants.length === 0
    ? "https://schema.org/InStock"
    : enquirable.some((v) => v.availability === "in_stock" || v.availability === "low_stock")
      ? "https://schema.org/InStock"
      : enquirable.some((v) => v.availability === "made_to_order")
        ? "https://schema.org/MadeToOrder"
        : "https://schema.org/OutOfStock";

  const offers =
    product.price === null
      ? undefined
      : product.price_mode === "fixed"
        ? { "@type": "Offer", price: product.price.toFixed(2), priceCurrency: product.currency, availability, url: product.seo.canonical_url }
        : { "@type": "AggregateOffer", lowPrice: product.price.toFixed(2), priceCurrency: product.currency, availability, url: product.seo.canonical_url, offerCount: Math.max(1, enquirable.length) };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.seo.description ?? undefined,
    brand: { "@type": "Brand", name: product.brand },
    image: product.gallery.slice(0, 6).map((g) => mediaUrl(g.media, "lg")).filter(Boolean),
    category: product.category?.name,
    color: product.options.colors.map((c) => c.label).join(", ") || undefined,
    material: product.attributes.find((a) => a.code === "fabric")?.value,
    url: product.seo.canonical_url,
    ...(offers ? { offers } : {}),
  };
}
