import type { Metadata } from "next";
import { BagView } from "@/components/store/bag-view";

export const metadata: Metadata = { title: "Enquiry Bag", robots: { index: false, follow: false } };

export default function BagPage() {
  return (
    <div className="container-editorial pt-10 pb-24 sm:pt-14">
      <h1 className="display text-display text-midnight">Enquiry Bag</h1>
      <p className="mt-3 max-w-xl text-muted">
        Gather the designs you love and send them to our team in one WhatsApp enquiry. We will confirm availability, sizing, delivery and payment with you personally.
      </p>
      <BagView />
    </div>
  );
}
