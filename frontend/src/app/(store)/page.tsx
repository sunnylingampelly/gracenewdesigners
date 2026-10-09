import { HomeSections } from "@/components/store/home-sections";
import { PreviewBanner } from "@/components/store/preview-banner";
import { ButtonLink } from "@/components/store/ui";
import { api } from "@/lib/api-server";
import { previewToken } from "@/lib/preview";

export default async function HomePage() {
  const token = await previewToken();
  const [sections, settings] = await Promise.all([api.homepage(token), api.settings()]);

  return (
    <>
      {token && <PreviewBanner path="/" />}
      {sections && sections.length > 0 ? (
        <HomeSections sections={sections} settings={settings} />
      ) : (
        <section className="container-editorial flex min-h-[60svh] flex-col items-center justify-center py-24 text-center">
          <p className="eyebrow mb-4 text-royal">{settings.brand_name}</p>
          <h1 className="display text-display text-midnight">{settings.tagline ?? "Modern Indian Couture"}</h1>
          <p className="mt-6 max-w-md text-muted">Our new season is being prepared. In the meantime, explore the collection.</p>
          <div className="mt-10">
            <ButtonLink href="/shop">Explore the Collection</ButtonLink>
          </div>
        </section>
      )}
    </>
  );
}
