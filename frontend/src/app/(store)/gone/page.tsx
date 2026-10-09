import type { Metadata } from "next";
import { ButtonLink } from "@/components/store/ui";

export const metadata: Metadata = {
  title: "No longer available",
  robots: { index: false, follow: true },
};

/** Rendered with HTTP 410 by the proxy for archived or removed designs. */
export default function GonePage() {
  return (
    <section className="container-editorial flex min-h-[60svh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow mb-4 text-royal">No longer available</p>
      <h1 className="display text-display text-midnight">This design has left the collection</h1>
      <p className="mt-6 max-w-md text-muted">
        Some pieces are created in limited numbers. Our team may be able to suggest something similar — or explore what is new.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/new-arrivals">See New Arrivals</ButtonLink>
        <ButtonLink href="/contact" variant="outline">Ask our team</ButtonLink>
      </div>
    </section>
  );
}
