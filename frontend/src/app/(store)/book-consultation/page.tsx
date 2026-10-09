import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/store/contact-form";
import { Breadcrumbs } from "@/components/store/ui";
import { api } from "@/lib/api-server";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Book a Consultation",
  description: "Arrange a personal styling or fitting consultation with our team.",
  alternates: { canonical: absoluteUrl("/book-consultation") },
};

export default async function ConsultationPage() {
  const settings = await api.settings();
  if (!settings.consultation_enabled) notFound();

  return (
    <div className="container-editorial pt-10 pb-24 sm:pt-14">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Book a Consultation" }]} />
      <div className="mt-8 grid gap-16 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="eyebrow text-royal">Personal service</p>
          <h1 className="display mt-4 text-display text-midnight">Your Perfect Look Begins Here</h1>
          <p className="mt-6 max-w-md leading-relaxed text-ink/80">
            Tell us about your occasion and we will arrange a consultation — in person or over video — to discuss designs, fabrics, colours and measurements.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-ink/80">
            <li>— Bridal and occasionwear guidance</li>
            <li>— Made-to-measure fittings</li>
            <li>— Timelines confirmed before production</li>
          </ul>
        </div>
        <div className="border-t border-line pt-10 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-16">
          <ContactForm mode="consultation" />
        </div>
      </div>
    </div>
  );
}
