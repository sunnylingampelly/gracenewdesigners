import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { ConsentAndAnalytics } from "@/components/store/consent-and-analytics";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { MobileBottomNavWrapper } from "@/components/store/mobile-bottom-nav-wrapper";
import { api, siteUrl } from "@/lib/api-server";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await api.settings();
  const suffix = settings.seo_title_suffix || settings.brand_name;

  return {
    title: { default: `${settings.brand_name} — ${settings.tagline ?? "Modern Men's Fashion"}`, template: `%s | ${suffix}` },
    description: settings.seo_default_description ?? undefined,
    applicationName: settings.brand_name,
    icons: settings.favicon ? { icon: settings.favicon.url } : undefined,
    verification: settings.google_site_verification ? { google: settings.google_site_verification } : undefined,
    openGraph: {
      type: "website",
      siteName: settings.brand_name,
      locale: "en_IN",
      url: siteUrl,
      images: settings.social_share ? [{ url: settings.social_share.url, width: settings.social_share.width ?? undefined, height: settings.social_share.height ?? undefined }] : undefined,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, navigation] = await Promise.all([api.settings(), api.navigation()]);

  const organization = {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: settings.brand_name,
    url: siteUrl,
    description: settings.brand_description ?? settings.seo_default_description ?? undefined,
    logo: settings.logo_primary?.url,
    email: settings.contact_email ?? undefined,
    telephone: settings.contact_phone ?? undefined,
    address: settings.address ?? undefined,
    sameAs: [settings.social_instagram, settings.social_facebook, settings.social_pinterest, settings.social_youtube, settings.social_x].filter(Boolean),
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-midnight focus:px-4 focus:py-2 focus:text-ivory">
        Skip to content
      </a>
      {settings.announcement_enabled && settings.announcement_text && (
        <div className="bg-midnight px-4 py-2 text-center text-[0.68rem] font-medium tracking-[0.2em] text-ivory uppercase">
          {settings.announcement_link ? (
            <Link href={settings.announcement_link} className="link-underline">{settings.announcement_text}</Link>
          ) : (
            settings.announcement_text
          )}
        </div>
      )}
      <Header items={navigation.header ?? []} secondary={navigation.mobile_secondary ?? []} settings={settings} />
      <main id="main" className="flex-1 pb-20 lg:pb-0">{children}</main>
      <Footer settings={settings} menus={{ shop: navigation.footer_shop ?? [], house: navigation.footer_house ?? [], help: navigation.footer_help ?? [] }} />
      <MobileBottomNavWrapper />
      <Suspense fallback={null}>
        <ConsentAndAnalytics ga4Id={settings.ga4_measurement_id} />
      </Suspense>
      <Toaster position="bottom-center" toastOptions={{ className: "!rounded-none !border-line !bg-paper !text-ink !font-sans" }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replace(/</g, "\\u003c") }} />
    </div>
  );
}
