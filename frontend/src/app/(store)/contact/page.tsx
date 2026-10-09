import type { Metadata } from "next";
import { ContactForm } from "@/components/store/contact-form";
import { Breadcrumbs, ButtonLink } from "@/components/store/ui";
import { api } from "@/lib/api-server";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Contact",
  description: "Speak with our team about a design, a fitting or a consultation.",
  alternates: { canonical: absoluteUrl("/contact") },
};

export default async function ContactPage() {
  const [settings, page] = await Promise.all([api.settings(), api.page("contact")]);
  const wa = settings.whatsapp_available && settings.whatsapp_business_number ? `https://wa.me/${settings.whatsapp_business_number.replace(/\D/g, "")}` : null;

  return (
    <div className="container-editorial pt-10 pb-24 sm:pt-14">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Contact" }]} />
      <div className="mt-8 grid gap-16 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h1 className="display text-display text-midnight">{page?.title ?? "Contact"}</h1>
          {page?.excerpt && <p className="display mt-5 text-2xl text-ink/80 italic">{page.excerpt}</p>}
          {page?.body && <div className="prose-couture mt-6" dangerouslySetInnerHTML={{ __html: page.body }} />}
          <dl className="mt-10 space-y-5 text-sm">
            {wa && (
              <div>
                <dt className="eyebrow text-muted">WhatsApp</dt>
                <dd className="mt-2"><ButtonLink href={wa}>Chat with us</ButtonLink></dd>
              </div>
            )}
            {settings.contact_phone && <div><dt className="eyebrow text-muted">Phone</dt><dd className="mt-1"><a href={`tel:${settings.contact_phone.replace(/\s/g, "")}`} className="link-underline">{settings.contact_phone}</a></dd></div>}
            {settings.contact_email && <div><dt className="eyebrow text-muted">Email</dt><dd className="mt-1"><a href={`mailto:${settings.contact_email}`} className="link-underline">{settings.contact_email}</a></dd></div>}
            {settings.address && <div><dt className="eyebrow text-muted">Studio</dt><dd className="mt-1 whitespace-pre-line">{settings.address}</dd></div>}
            {settings.business_hours && <div><dt className="eyebrow text-muted">Hours</dt><dd className="mt-1">{settings.business_hours}</dd></div>}
            {settings.map_url && <div><dd><a href={settings.map_url} target="_blank" rel="noopener noreferrer" className="text-royal underline underline-offset-4">Open in maps</a></dd></div>}
          </dl>
        </div>
        <div className="border-t border-line pt-10 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-16">
          <h2 className="display text-display-sm text-midnight">Send a message</h2>
          <div className="mt-8"><ContactForm mode="contact" /></div>
        </div>
      </div>
    </div>
  );
}
