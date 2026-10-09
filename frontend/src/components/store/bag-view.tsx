"use client";

/* eslint-disable @next/next/no-img-element -- bag thumbnails are stored renditions */
import { Loader2, Minus, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ApiRequestError } from "@/lib/api-client";
import { openWhatsApp, submitEnquiry } from "@/lib/enquiry";
import { MAX_QUANTITY, useBag, useHydrated } from "@/lib/stores";
import type { EnquiryResult } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { FallbackDialog } from "./product/purchase-panel";
import { ButtonLink } from "./ui";

export function BagView() {
  const hydrated = useHydrated();
  const { items, setQuantity, remove, clear } = useBag();
  const [submitting, setSubmitting] = useState(false);
  const [fallback, setFallback] = useState<EnquiryResult | null>(null);
  const [problems, setProblems] = useState<Record<number, string>>({});

  if (!hydrated) {
    return <div className="mt-10 space-y-4" aria-busy="true">{[0, 1].map((i) => <div key={i} className="skeleton h-32" />)}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="mt-12 border border-dashed border-line-strong px-6 py-20 text-center">
        <p className="display text-3xl text-midnight">Your enquiry bag is empty</p>
        <p className="mt-3 text-muted">Add designs with your preferred size and colour, then enquire about them together.</p>
        <div className="mt-8"><ButtonLink href="/shop">Explore the Collection</ButtonLink></div>
      </div>
    );
  }

  const pricedTotal = items.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.quantity, 0);
  const hasUnpriced = items.some((i) => i.unitPrice === null || i.priceMode !== "fixed");

  const enquire = async () => {
    setSubmitting(true);
    setProblems({});
    try {
      const result = await submitEnquiry({
        type: items.length === 1 ? "product" : "bag",
        items: items.map((i) => ({ product_id: i.productId, variant_id: i.variantId, color_value_id: i.customSize ? i.colorId : null, custom_size: i.customSize, quantity: i.quantity })),
        fitting_consultation: items.some((i) => i.customSize),
      });
      if (!openWhatsApp(result)) setFallback(result);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        // Map per-item server errors (e.g. "items.2.variant_id") back to bag rows.
        const mapped: Record<number, string> = {};
        for (const [key, messages] of Object.entries(error.errors)) {
          const match = key.match(/^items\.(\d+)\./);
          if (match) mapped[Number(match[1])] = messages[0];
        }
        setProblems(mapped);
        toast.error(Object.keys(mapped).length ? "Some designs need your attention before enquiring." : error.message);
      } else {
        toast.error("We could not start your enquiry. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_22rem]">
      <ul className="divide-y divide-line border-y border-line">
        {items.map((item, index) => (
          <li key={item.key} className="flex gap-4 py-6 sm:gap-6">
            <Link href={`/products/${item.slug}`} className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden bg-ice sm:w-32">
              {item.imageUrl && <img src={item.imageUrl} alt={item.imageAlt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/products/${item.slug}`} className="display text-xl leading-snug hover:text-royal sm:text-2xl">{item.name}</Link>
                  <p className="mt-1 text-sm text-muted">{[item.sizeLabel, item.colorLabel].filter(Boolean).join(" · ") || "One size"}</p>
                  <p className="text-xs text-muted">Ref. {item.variantSku ?? item.sku}</p>
                </div>
                <button type="button" onClick={() => remove(item.key)} aria-label={`Remove ${item.name}`} className="-mt-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-auto flex items-end justify-between gap-4 pt-4">
                <div className="flex h-10 items-center border border-line-strong">
                  <button type="button" onClick={() => setQuantity(item.key, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Decrease quantity" className="inline-flex h-full w-10 items-center justify-center disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button>
                  <output className="w-7 text-center text-sm" aria-label="Quantity">{item.quantity}</output>
                  <button type="button" onClick={() => setQuantity(item.key, item.quantity + 1)} disabled={item.quantity >= MAX_QUANTITY} aria-label="Increase quantity" className="inline-flex h-full w-10 items-center justify-center disabled:opacity-30"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <p className="text-sm">{item.priceLabel}</p>
              </div>
              {problems[index] && <p role="alert" className="mt-3 text-sm text-danger">{problems[index]} <Link href={`/products/${item.slug}`} className="underline">Update selection</Link></p>}
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit border border-line bg-paper p-6 lg:sticky lg:top-32">
        <h2 className="text-[0.72rem] font-semibold tracking-[0.18em] uppercase">Summary</h2>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Designs</dt><dd>{items.length}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Pieces</dt><dd>{items.reduce((s, i) => s + i.quantity, 0)}</dd></div>
          {pricedTotal > 0 && (
            <div className="flex justify-between border-t border-line pt-3"><dt className="text-muted">Displayed prices</dt><dd>{hasUnpriced ? "From " : ""}{formatMoney(pricedTotal)}</dd></div>
          )}
        </dl>
        {hasUnpriced && <p className="mt-3 text-xs leading-relaxed text-muted">Some designs are priced on request or from a starting price. Final pricing is confirmed by our team.</p>}
        <button type="button" onClick={enquire} disabled={submitting} className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 bg-midnight text-[0.72rem] font-semibold tracking-[0.2em] text-ivory uppercase hover:bg-navy disabled:opacity-50">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Enquire on WhatsApp
        </button>
        <p className="mt-3 text-xs leading-relaxed text-muted">Opens WhatsApp with a list of your designs and a reference number. No payment is taken online.</p>
        <button type="button" onClick={() => { if (window.confirm("Remove all designs from your bag?")) clear(); }} className="mt-6 text-[0.68rem] font-semibold tracking-[0.16em] text-muted uppercase hover:text-ink">
          Clear bag
        </button>
      </aside>
      <FallbackDialog result={fallback} onClose={() => setFallback(null)} />
    </div>
  );
}
