import Link from "next/link";
import { MediaImage } from "@/components/media/media-image";
import type { HomepageSection, Media, ProductCard as Card, PublicSettings } from "@/lib/types";
import { cn, splitParagraphs } from "@/lib/utils";
import { getHeroImage } from "@/lib/unsplash-fallback";
import { HeroVideo } from "./hero-video";
import { NewsletterForm } from "./newsletter-form";
import { ProductCard } from "./product-card";
import { ProductRail } from "./product-rail";
import { Reveal } from "./reveal";
import { ButtonLink, SectionHeading } from "./ui";

type Data = Record<string, unknown>;
const str = (d: Data, key: string) => (typeof d[key] === "string" && d[key] ? (d[key] as string) : null);
const media = (d: Data, key: string) => (d[key] as Media | null | undefined) ?? null;
const list = <T,>(d: Data, key: string) => (Array.isArray(d[key]) ? (d[key] as T[]) : []);

type Theme = "ivory" | "white" | "navy" | "ice";
const themeClass: Record<Theme, string> = {
  ivory: "bg-ivory text-ink",
  white: "bg-paper text-ink",
  navy: "bg-midnight text-ivory",
  ice: "bg-ice text-ink",
};

export function HomeSections({ sections, settings }: { sections: HomepageSection[]; settings: PublicSettings }) {
  return (
    <>
      {sections.map((section, index) => {
        const d = section.data;
        const key = `${section.type}-${section.id}`;
        switch (section.type) {
          case "hero_image":
          case "hero_video":
            return <Hero key={key} d={d} video={section.type === "hero_video"} first={index === 0} />;
          case "category_grid":
            return <CategoryGrid key={key} d={d} />;
          case "collection_feature":
          case "split_editorial":
          case "text_image":
          case "brand_story":
            return <SplitEditorial key={key} d={d} />;
          case "featured_products":
            return <FeaturedProducts key={key} d={d} listName={`home:${section.id}`} />;
          case "occasion_grid":
            return <OccasionGrid key={key} d={d} />;
          case "lookbook_gallery":
            return <LookbookGallery key={key} d={d} />;
          case "craftsmanship":
            return <Craftsmanship key={key} d={d} />;
          case "testimonials":
            return <Testimonials key={key} d={d} />;
          case "appointment_cta":
            return <AppointmentCta key={key} d={d} settings={settings} />;
          case "social_gallery":
            return <SocialGallery key={key} d={d} />;
          case "newsletter":
            return settings.newsletter_enabled ? <Newsletter key={key} d={d} /> : null;
          default:
            return null;
        }
      })}
    </>
  );
}

function Hero({ d, video, first }: { d: Data; video: boolean; first: boolean }) {
  const desktop = media(d, "desktop_media");
  const mobile = media(d, "mobile_media");
  const align = (str(d, "align") ?? "center") as "left" | "center" | "right";
  const height = str(d, "height") ?? "full";
  const overlay = typeof d.overlay_opacity === "number" ? d.overlay_opacity : 0.35;
  const Heading = first ? "h1" : "h2";

  return (
    <section
      className={cn(
        "relative isolate flex overflow-hidden bg-midnight text-ivory",
        height === "full" ? "min-h-[calc(100svh-4rem)] lg:min-h-[calc(100svh-7.5rem)]" : height === "large" ? "min-h-[75svh]" : "min-h-[55svh]",
      )}
      data-theme="dark-section"
    >
      {video && media(d, "video_media") ? (
        <HeroVideo video={media(d, "video_media")!} poster={desktop} />
      ) : (
        <>
          <MediaImage media={desktop} sizes="100vw" fill priority={first} className={cn(mobile && "hidden md:block")} />
          {mobile && <MediaImage media={mobile} sizes="100vw" fill priority={first} className="md:hidden" />}
        </>
      )}
      <div aria-hidden className="absolute inset-0 -z-0 bg-gradient-to-t from-midnight via-midnight/30 to-transparent" style={{ opacity: Math.min(1, overlay * 2.2) }} />
      <div
        className={cn(
          "container-editorial relative z-10 flex flex-col justify-end pt-24 pb-16 sm:pb-24",
          align === "center" && "items-center text-center",
          align === "right" && "items-end text-right",
        )}
      >
        <div className="max-w-3xl animate-fade-up">
          {str(d, "eyebrow") && <p className="eyebrow mb-5 text-ivory/85">{str(d, "eyebrow")}</p>}
          <Heading className="display text-display-lg text-balance">{str(d, "headline")}</Heading>
          {str(d, "subtitle") && <p className="mx-auto mt-6 max-w-xl text-[1rem] leading-relaxed text-ivory/85 sm:text-[1.05rem]">{str(d, "subtitle")}</p>}
          {str(d, "cta_label") && str(d, "cta_url") && (
            <div className="mt-10">
              <ButtonLink href={str(d, "cta_url")!} variant="ghost-light">{str(d, "cta_label")}</ButtonLink>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CategoryGrid({ d }: { d: Data }) {
  const items = list<{ label: string; url: string; media: Media | null }>(d, "items");
  return (
    <section className="py-[var(--spacing-section)]">
      <div className="container-editorial">
        <SectionHeading eyebrow={str(d, "eyebrow")} title={str(d, "title")} subtitle={str(d, "subtitle")} />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:gap-x-8">
          {items.map((item, i) => (
            <li key={item.url}>
              <Reveal delay={(i % 3) * 90}>
                <Link href={item.url} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-ice">
                    <MediaImage media={item.media} sizes="(min-width: 768px) 33vw, 50vw" fill alt={item.label} className="transition-transform duration-[1.4s] ease-[var(--ease-luxe)] group-hover:scale-[1.04]" />
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <h3 className="display text-[1.35rem] sm:text-[1.6rem]">{item.label}</h3>
                    <span className="hidden text-[0.65rem] font-semibold tracking-[0.2em] text-royal uppercase sm:inline">Explore</span>
                  </div>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SplitEditorial({ d }: { d: Data }) {
  const theme = (str(d, "theme") ?? "ivory") as Theme;
  const imageRight = str(d, "image_position") === "right";
  const image = media(d, "media");
  const dark = theme === "navy";

  return (
    <section className={cn(themeClass[theme])} data-theme={dark ? "dark-section" : undefined}>
      <div className={cn("grid items-stretch lg:grid-cols-2", imageRight && "lg:[&>*:first-child]:order-2")}>
        <div className="relative min-h-[70svh] overflow-hidden bg-ice lg:min-h-[88svh]">
          <MediaImage media={image} sizes="(min-width: 1024px) 50vw, 100vw" fill />
        </div>
        <div className="flex items-center px-[var(--spacing-gutter)] py-20 lg:px-20 xl:px-28">
          <Reveal className="max-w-lg">
            {str(d, "eyebrow") && <p className={cn("eyebrow mb-6", dark ? "text-sky" : "text-royal")}>{str(d, "eyebrow")}</p>}
            {str(d, "title") && <h2 className="display text-display">{str(d, "title")}</h2>}
            {str(d, "subtitle") && <p className="display mt-4 text-2xl italic opacity-80">{str(d, "subtitle")}</p>}
            <div className={cn("mt-8 space-y-4 text-[1rem] leading-[1.85]", dark ? "text-ivory/80" : "text-ink/80")}>
              {splitParagraphs(str(d, "body")).map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {str(d, "cta_label") && str(d, "cta_url") && (
              <div className="mt-10">
                <ButtonLink href={str(d, "cta_url")!} variant={dark ? "ghost-light" : "outline"}>{str(d, "cta_label")}</ButtonLink>
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FeaturedProducts({ d, listName }: { d: Data; listName: string }) {
  const products = list<Card>(d, "products");
  const carousel = str(d, "layout") === "carousel";
  const cta = str(d, "cta_label") && str(d, "cta_url") ? (
    <Link href={str(d, "cta_url")!} className="text-[0.7rem] font-semibold tracking-[0.2em] text-royal uppercase">
      <span className="link-underline">{str(d, "cta_label")}</span>
    </Link>
  ) : null;

  return (
    <section className="py-[var(--spacing-section)]">
      <div className="container-editorial">
        <SectionHeading eyebrow={str(d, "eyebrow")} title={str(d, "title")} subtitle={str(d, "subtitle")} align="left" action={cta} />
        {carousel ? (
          <ProductRail products={products} listName={listName} />
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-6">
            {products.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} listName={listName} index={i} sizes="(min-width: 768px) 25vw, 50vw" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function OccasionGrid({ d }: { d: Data }) {
  const items = list<{ label: string; url: string; media: Media | null }>(d, "items");
  return (
    <section className="bg-paper py-[var(--spacing-section)]">
      <div className="container-editorial">
        <SectionHeading eyebrow={str(d, "eyebrow")} title={str(d, "title")} subtitle={str(d, "subtitle")} />
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {items.map((item, i) => (
            <li key={item.url}>
              <Link href={item.url} className="group relative block aspect-[3/4] overflow-hidden bg-navy">
                <MediaImage media={item.media} sizes="(min-width: 1024px) 25vw, 50vw" fill alt="" className="opacity-85 transition-[transform,opacity] duration-[1.2s] ease-[var(--ease-luxe)] group-hover:scale-[1.04] group-hover:opacity-100" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-midnight/75 via-transparent to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-4 text-ivory sm:p-6">
                  <span className="eyebrow block text-ivory/75">{String(i + 1).padStart(2, "0")}</span>
                  <span className="display mt-1 block text-[1.5rem] sm:text-[1.9rem]">{item.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function LookbookGallery({ d }: { d: Data }) {
  const items = list<{ media: Media | null; caption: string | null; url: string | null }>(d, "items").slice(0, 5);
  return (
    <section className="py-[var(--spacing-section)]">
      <div className="container-editorial">
        <SectionHeading
          eyebrow={str(d, "eyebrow")}
          title={str(d, "title")}
          subtitle={str(d, "subtitle")}
          align="left"
          action={str(d, "cta_url") ? <Link href={str(d, "cta_url")!} className="text-[0.7rem] font-semibold tracking-[0.2em] text-royal uppercase"><span className="link-underline">{str(d, "cta_label") ?? "View the Lookbook"}</span></Link> : null}
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-12 lg:grid-rows-2">
          {items.map((item, i) => {
            const span = ["lg:col-span-5 lg:row-span-2", "lg:col-span-4", "lg:col-span-3", "lg:col-span-3", "lg:col-span-4"][i] ?? "lg:col-span-4";
            const tile = (
              <figure className="group relative h-full">
                <div className={cn("relative overflow-hidden bg-ice", i === 0 ? "aspect-[4/5] lg:aspect-auto lg:h-full" : "aspect-[4/5]")}>
                  <MediaImage media={item.media} sizes="(min-width: 1024px) 40vw, 50vw" fill className="transition-transform duration-[1.4s] ease-[var(--ease-luxe)] group-hover:scale-[1.03]" />
                </div>
                {item.caption && <figcaption className="mt-3 text-[0.7rem] tracking-[0.14em] text-muted uppercase">{item.caption}</figcaption>}
              </figure>
            );
            return (
              <div key={i} className={cn(span, i === 0 && "col-span-2 lg:col-span-5")}>
                {item.url ? <Link href={item.url}>{tile}</Link> : tile}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Craftsmanship({ d }: { d: Data }) {
  const pillars = list<{ title: string; body: string | null; media: Media | null }>(d, "pillars");
  return (
    <section className="bg-ice py-[var(--spacing-section)]">
      <div className="container-editorial grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Reveal>
            {str(d, "eyebrow") && <p className="eyebrow mb-6 text-royal">{str(d, "eyebrow")}</p>}
            {str(d, "title") && <h2 className="display text-display text-midnight">{str(d, "title")}</h2>}
            {str(d, "body") && <p className="mt-6 max-w-md text-[1rem] leading-relaxed text-ink/80">{str(d, "body")}</p>}
            {media(d, "media") && (
              <div className="relative mt-10 aspect-[4/5] max-w-md overflow-hidden">
                <MediaImage media={media(d, "media")} sizes="(min-width: 1024px) 35vw, 100vw" fill />
              </div>
            )}
          </Reveal>
        </div>
        <ol className="grid content-center gap-x-10 gap-y-12 sm:grid-cols-2 lg:col-span-7">
          {pillars.map((pillar, i) => (
            <li key={pillar.title} className="border-t border-midnight/15 pt-6">
              <Reveal delay={i * 100}>
                <span className="display text-4xl text-royal/60">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="display mt-3 text-[1.75rem] text-midnight">{pillar.title}</h3>
                {pillar.body && <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/75">{pillar.body}</p>}
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Testimonials({ d }: { d: Data }) {
  const items = list<{ quote: string; author: string; location: string | null; occasion: string | null }>(d, "items");
  return (
    <section className="py-[var(--spacing-section)]">
      <div className="container-editorial">
        <SectionHeading eyebrow={str(d, "eyebrow")} title={str(d, "title")} />
        <ul className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <li key={t.author + t.quote.slice(0, 20)}>
              <figure className="border-t border-line pt-8">
                <blockquote className="display text-[1.45rem] leading-snug text-midnight italic">“{t.quote}”</blockquote>
                <figcaption className="mt-6 text-[0.7rem] tracking-[0.16em] text-muted uppercase">
                  {t.author}
                  {[t.location, t.occasion].filter(Boolean).length > 0 && <span> — {[t.location, t.occasion].filter(Boolean).join(", ")}</span>}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AppointmentCta({ d, settings }: { d: Data; settings: PublicSettings }) {
  const wa = settings.whatsapp_available && settings.whatsapp_business_number
    ? `https://wa.me/${settings.whatsapp_business_number.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello ${settings.brand_name}, I would like to speak with your team.`)}`
    : null;
  return (
    <section className="bg-midnight text-ivory" data-theme="dark-section">
      <div className="grid lg:grid-cols-2">
        <div className="flex items-center px-[var(--spacing-gutter)] py-20 lg:px-20 xl:px-28">
          <Reveal className="max-w-lg">
            {str(d, "eyebrow") && <p className="eyebrow mb-6 text-sky">{str(d, "eyebrow")}</p>}
            <h2 className="display text-display">{str(d, "title") ?? "Your Perfect Look Begins Here"}</h2>
            {str(d, "body") && <p className="mt-6 text-[1rem] leading-relaxed text-ivory/80">{str(d, "body")}</p>}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              {settings.consultation_enabled && <ButtonLink href="/book-consultation" variant="light">{str(d, "consultation_label") ?? "Book a Consultation"}</ButtonLink>}
              {wa && <ButtonLink href={wa} variant="ghost-light">{str(d, "whatsapp_label") ?? "Chat on WhatsApp"}</ButtonLink>}
            </div>
          </Reveal>
        </div>
        <div className="relative min-h-[60svh] overflow-hidden lg:min-h-[80svh]">
          <MediaImage media={media(d, "media")} sizes="(min-width: 1024px) 50vw, 100vw" fill />
        </div>
      </div>
    </section>
  );
}

function SocialGallery({ d }: { d: Data }) {
  const items = list<{ media: Media | null; url: string | null; alt: string | null }>(d, "items");
  return (
    <section className="py-[var(--spacing-section)]">
      <div className="container-editorial">
        <SectionHeading eyebrow={str(d, "eyebrow")} title={str(d, "title")} subtitle={str(d, "handle")} />
        <ul className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
          {items.map((item, i) => {
            const image = <MediaImage media={item.media} sizes="(min-width: 1024px) 16vw, 33vw" fill alt={item.alt ?? ""} className="transition-transform duration-700 group-hover:scale-[1.04]" />;
            return (
              <li key={i} className="group relative aspect-square overflow-hidden bg-ice">
                {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={item.alt ?? "Open post"}>{image}</a> : image}
              </li>
            );
          })}
        </ul>
        {str(d, "profile_url") && (
          <div className="mt-10 text-center">
            <ButtonLink href={str(d, "profile_url")!} variant="outline">Follow {str(d, "handle") ?? "the studio"}</ButtonLink>
          </div>
        )}
      </div>
    </section>
  );
}

function Newsletter({ d }: { d: Data }) {
  return (
    <section className="border-t border-line bg-paper py-20">
      <div className="container-editorial max-w-xl text-center">
        <h2 className="display text-display-sm text-midnight">{str(d, "title") ?? "The Grace Letter"}</h2>
        {str(d, "body") && <p className="mt-4 text-muted">{str(d, "body")}</p>}
        <div className="mt-8 text-left">
          <NewsletterForm source="homepage" consentText={str(d, "consent_text") ?? undefined} />
        </div>
      </div>
    </section>
  );
}
