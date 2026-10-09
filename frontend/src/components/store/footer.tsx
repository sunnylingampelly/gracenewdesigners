import Link from "next/link";
import type { NavItem, PublicSettings } from "@/lib/types";
import { Logo } from "./logo";
import { NewsletterForm } from "./newsletter-form";

type Props = { settings: PublicSettings; menus: { shop: NavItem[]; house: NavItem[]; help: NavItem[] } };

export function Footer({ settings, menus }: Props) {
  const socials = [
    ["Instagram", settings.social_instagram],
    ["Facebook", settings.social_facebook],
    ["Pinterest", settings.social_pinterest],
    ["YouTube", settings.social_youtube],
    ["X", settings.social_x],
  ].filter((s): s is [string, string] => Boolean(s[1]));

  return (
    <footer className="mt-auto bg-midnight text-ivory/85" data-theme="dark-section">
      <div className="container-editorial grid gap-14 py-16 md:py-20 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo brandName={settings.brand_name} logo={settings.logo_dark_bg} tone="light" height={46} />
          {settings.tagline && <p className="display mt-6 max-w-xs text-2xl leading-snug text-ivory">{settings.tagline}</p>}
          {settings.newsletter_enabled && (
            <div className="mt-10 max-w-sm">
              <p className="eyebrow mb-3 text-sky">The Grace Letter</p>
              <NewsletterForm source="footer" tone="dark" />
            </div>
          )}
        </div>

        <FooterColumn title="Shop" items={menus.shop} />
        <FooterColumn title="The House" items={menus.house} />
        <FooterColumn title="Client Care" items={menus.help} />

        <div className="lg:col-span-2">
          <p className="eyebrow mb-5 text-sky">Contact</p>
          <ul className="space-y-3 text-sm leading-relaxed">
            {settings.whatsapp_available && settings.whatsapp_business_number && (
              <li>
                <a href={`https://wa.me/${settings.whatsapp_business_number.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="link-underline">
                  WhatsApp {settings.whatsapp_business_number}
                </a>
              </li>
            )}
            {settings.contact_phone && (
              <li>
                <a href={`tel:${settings.contact_phone.replace(/\s/g, "")}`} className="link-underline">{settings.contact_phone}</a>
              </li>
            )}
            {settings.contact_email && (
              <li>
                <a href={`mailto:${settings.contact_email}`} className="link-underline break-all">{settings.contact_email}</a>
              </li>
            )}
            {settings.address && <li className="whitespace-pre-line text-ivory/70">{settings.address}</li>}
            {settings.business_hours && <li className="text-ivory/70">{settings.business_hours}</li>}
            <li>
              <Link href="/contact" className="link-underline">Send us a message</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ivory/10">
        <div className="container-editorial flex flex-col gap-4 py-6 text-xs tracking-[0.06em] text-ivory/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {settings.brand_name}. All rights reserved.</p>
          {socials.length > 0 && (
            <ul className="flex flex-wrap gap-5">
              {socials.map(([label, url]) => (
                <li key={label}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="link-underline">{label}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: NavItem[] }) {
  if (!items.length) return null;
  return (
    <div className="lg:col-span-2">
      <p className="eyebrow mb-5 text-sky">{title}</p>
      <ul className="space-y-3 text-sm">
        {items.map((item) =>
          item.url ? (
            <li key={item.id}>
              <Link href={item.url} className="link-underline">{item.label}</Link>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}
