"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, Minus, Plus, Ruler, Share2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { ApiRequestError } from "@/lib/api-client";
import { openWhatsApp, submitEnquiry } from "@/lib/enquiry";
import { MAX_QUANTITY, useBag } from "@/lib/stores";
import type { EnquiryResult, ProductDetail } from "@/lib/types";
import { cn, formatMoney, mediaUrl } from "@/lib/utils";
import { WishlistButton } from "../wishlist-button";
import { colorStates, initialSelection, resolveSelection, sizeStates } from "./variant-matrix";

type Props = { product: ProductDetail; onColorChange?: (colorCode: string | null, variantImageId: number | null) => void };

const MEASUREMENTS = [
  { key: "bust_chest", label: "Bust / Chest" },
  { key: "waist", label: "Waist" },
  { key: "hip", label: "Hip" },
  { key: "shoulder", label: "Shoulder" },
  { key: "height", label: "Height" },
] as const;

export function PurchasePanel({ product, onColorChange }: Props) {
  const initial = useMemo(() => initialSelection(product), [product]);
  const [colorId, setColorId] = useState<number | null>(initial.colorId);
  const [sizeId, setSizeId] = useState<number | null>(initial.sizeId);
  const [customSize, setCustomSize] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [fallback, setFallback] = useState<EnquiryResult | null>(null);
  const addToBag = useBag((s) => s.add);
  const router = useRouter();

  const sizes = sizeStates(product, colorId);
  const colors = colorStates(product);
  const selection = resolveSelection(product, sizeId, colorId, customSize);
  const variant = selection.status === "ready" ? selection.variant : null;
  const color = product.options.colors.find((c) => c.id === colorId) ?? null;
  const size = product.options.sizes.find((s) => s.id === sizeId) ?? null;
  const priceLabel = variant?.price_label && product.price_mode === "fixed" ? variant.price_label : product.price_label;
  const compareAt = product.price_mode === "fixed" ? (variant?.compare_at_price ?? product.compare_at_price) : null;
  const noneAvailable = product.variants.length > 0 && !product.variants.some((v) => v.is_enquirable) && !product.allows_custom_size;

  const chooseColor = (id: number) => {
    setColorId(id);
    const c = product.options.colors.find((o) => o.id === id);
    track("select_color", { product_id: product.id, color: c?.label });
    const v = product.variants.find((x) => x.color_id === id && x.image);
    onColorChange?.(c?.code ?? null, v?.image?.id ?? null);
  };

  const chooseSize = (id: number) => {
    setCustomSize(false);
    setSizeId(id);
    track("select_size", { product_id: product.id, size: product.options.sizes.find((s) => s.id === id)?.label });
  };

  const itemPayload = () => ({
    product_id: product.id,
    variant_id: customSize ? null : (variant?.id ?? null),
    color_value_id: customSize ? colorId : null,
    custom_size: customSize,
    quantity,
  });

  const enquire = async (extra: Extra = {}) => {
    setAttempted(true);
    if (selection.status !== "ready") return;
    setSubmitting(true);
    try {
      const result = await submitEnquiry({ type: "product", items: [itemPayload()], fitting_consultation: customSize, ...extra });
      if (!openWhatsApp(result)) setFallback(result);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? (Object.values(error.errors)[0]?.[0] ?? error.message) : "We could not start your enquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onPrimary = () => {
    setAttempted(true);
    if (selection.status !== "ready") return;
    if (customSize) setDetailsOpen(true);
    else void enquire();
  };

  const onAddToBag = () => {
    setAttempted(true);
    if (selection.status !== "ready") return;
    addToBag({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      imageUrl: mediaUrl(variant?.image ?? product.gallery[0]?.media, "sm") ?? null,
      imageAlt: product.gallery[0]?.media.alt || product.name,
      variantId: customSize ? null : (variant?.id ?? null),
      variantSku: variant?.sku ?? null,
      colorId: customSize ? colorId : (variant?.color_id ?? null),
      sizeLabel: customSize ? "Custom size" : (size?.label ?? null),
      colorLabel: color?.label ?? null,
      customSize,
      quantity,
      priceMode: product.price_mode,
      unitPrice: product.price_mode === "on_request" ? null : (variant?.price ?? product.price),
      priceLabel,
    });
    track("add_to_bag", { product_id: product.id, quantity });
    toast.success("Added to your enquiry bag", { action: { label: "View bag", onClick: () => router.push("/bag") } });
  };

  const share = async () => {
    const url = window.location.href.split("?")[0];
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="space-y-7">
      <div>
        {product.category && (
          <Link href={`/shop/${product.category.path}`} className="text-[0.68rem] font-semibold tracking-[0.2em] text-muted uppercase hover:text-royal">
            {product.category.name}
          </Link>
        )}
        <h1 className="display mt-3 text-[2.2rem] leading-[1.08] text-midnight sm:text-[2.75rem]">{product.name}</h1>
        <div className="mt-4 flex flex-wrap items-baseline gap-3">
          <p className="text-[1.15rem] font-medium text-ink" aria-live="polite">{priceLabel}</p>
          {compareAt && <p className="text-sm text-muted line-through">{formatMoney(compareAt, product.currency)}</p>}
          {product.badges.map((b) => <span key={b} className="border border-royal/30 px-2 py-0.5 text-[0.6rem] font-semibold tracking-[0.16em] text-royal uppercase">{b}</span>)}
        </div>
        {product.tax_note && <p className="mt-1 text-xs text-muted">{product.tax_note}</p>}
        {product.price_mode === "on_request" && <p className="mt-1 text-xs text-muted">Pricing is shared personally by our team on WhatsApp.</p>}
        {product.short_description && <p className="mt-5 leading-relaxed text-ink/80">{product.short_description}</p>}
      </div>

      {product.options.colors.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-[0.7rem] font-semibold tracking-[0.18em] uppercase">
            Colour{color && <span className="ml-2 font-normal tracking-normal text-muted normal-case">{color.label}</span>}
          </legend>
          <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-3">
            {product.options.colors.map((c) => {
              const state = colors.get(c.id);
              const selected = c.id === colorId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${c.label}${state?.enquirable ? "" : " — currently unavailable"}`}
                  onClick={() => chooseColor(c.id)}
                  className={cn("relative h-10 w-10 rounded-full p-0.5 transition-shadow", selected ? "ring-1 ring-midnight ring-offset-2 ring-offset-ivory" : "ring-1 ring-transparent hover:ring-line-strong")}
                >
                  <span className="block h-full w-full rounded-full border border-ink/15" style={{ background: c.hex ?? "#ddd" }} />
                  {!state?.enquirable && <span aria-hidden className="absolute inset-0 m-auto h-px w-9 rotate-45 bg-ink/60" />}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {(product.options.sizes.length > 0 || product.allows_custom_size) && (
        <fieldset>
          <div className="mb-3 flex items-center justify-between">
            <legend className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase">
              Size{(size || customSize) && <span className="ml-2 font-normal tracking-normal text-muted normal-case">{customSize ? "Custom size" : size?.label}</span>}
            </legend>
            {product.size_chart && <SizeGuide chart={product.size_chart} />}
          </div>
          <div role="radiogroup" aria-label="Size" className="flex flex-wrap gap-2">
            {product.options.sizes.map((s) => {
              const state = sizes.get(s.id);
              const selected = !customSize && s.id === sizeId;
              const disabled = !state?.exists;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={disabled ? `${s.label} — not made in this colour` : !state?.enquirable ? `${s.label} — currently unavailable` : s.label}
                  disabled={disabled}
                  onClick={() => chooseSize(s.id)}
                  title={disabled ? "Not made in this colour" : !state?.enquirable ? "Currently unavailable" : undefined}
                  className={cn(
                    "relative min-h-11 min-w-14 border px-3 text-sm transition-colors",
                    selected ? "border-midnight bg-midnight text-ivory" : "border-line-strong hover:border-ink",
                    disabled && "cursor-not-allowed border-line text-muted/50 hover:border-line",
                    !disabled && !state?.enquirable && "text-muted line-through decoration-muted/70",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
            {product.allows_custom_size && (
              <button type="button" role="radio" aria-checked={customSize} onClick={() => { setCustomSize(true); setSizeId(null); }} className={cn("min-h-11 border px-4 text-sm transition-colors", customSize ? "border-midnight bg-midnight text-ivory" : "border-line-strong hover:border-ink")}>
                Custom Size
              </button>
            )}
          </div>
          {customSize && <p className="mt-3 text-sm text-muted">We will tailor this design to your measurements. You can share them now (optional) or during a fitting consultation.</p>}
        </fieldset>
      )}

      <div className="flex items-center gap-6">
        <div>
          <span id="qty-label" className="mb-3 block text-[0.7rem] font-semibold tracking-[0.18em] uppercase">Quantity</span>
          <div className="flex h-11 items-center border border-line-strong" role="group" aria-labelledby="qty-label">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Decrease quantity" className="inline-flex h-full w-11 items-center justify-center disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button>
            <output aria-live="polite" className="w-8 text-center text-sm">{quantity}</output>
            <button type="button" onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))} disabled={quantity >= MAX_QUANTITY} aria-label="Increase quantity" className="inline-flex h-full w-11 items-center justify-center disabled:opacity-30"><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="pt-7 text-sm">
          {variant ? (
            <p className={cn(variant.availability === "out_of_stock" ? "text-danger" : "text-success")}>{variant.availability_label}</p>
          ) : customSize ? (
            <p className="text-success">Made to your measurements</p>
          ) : noneAvailable ? (
            <p className="text-danger">Currently unavailable</p>
          ) : null}
          {variant && <p className="text-xs text-muted">Ref. {variant.sku}</p>}
        </div>
      </div>

      {attempted && selection.status !== "ready" && (
        <p role="alert" className="text-sm text-danger">{selection.message}</p>
      )}

      <div className="space-y-3">
        <button type="button" onClick={onPrimary} disabled={submitting || noneAvailable} className="flex min-h-14 w-full items-center justify-center gap-3 bg-midnight px-6 text-[0.72rem] font-semibold tracking-[0.2em] text-ivory uppercase transition-colors hover:bg-navy disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppGlyph />}
          {product.cta_label}
        </button>
        <div className="grid grid-cols-[1fr_auto_auto] gap-3">
          <button type="button" onClick={onAddToBag} disabled={noneAvailable} className="min-h-12 border border-ink/30 px-4 text-[0.7rem] font-semibold tracking-[0.18em] uppercase transition-colors hover:border-ink disabled:opacity-50">
            Add to Enquiry Bag
          </button>
          <WishlistButton
            placement="detail"
            className="px-4"
            product={{ id: product.id, slug: product.slug, name: product.name, url: product.url, category: product.category?.name ?? null, badges: [], image: product.gallery[0]?.media ?? null, hover_image: null, colors: [], is_available: true, allows_custom_size: product.allows_custom_size, price_mode: product.price_mode, price: product.price, compare_at_price: null, currency: product.currency, price_label: product.price_label, cta_label: product.cta_label }}
          />
          <button type="button" onClick={share} aria-label="Share this design" className="inline-flex min-h-12 w-12 items-center justify-center border border-ink/25 hover:border-ink">
            <Share2 className="h-4 w-4" strokeWidth={1.4} />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Our team confirms availability, measurements, delivery and payment personally on WhatsApp. No online payment is taken on this website.
        </p>
      </div>

      {(product.is_made_to_order || product.lead_time) && (
        <div className="border-l border-gold pl-4 text-sm">
          {product.is_made_to_order && <p className="font-medium">Made to order</p>}
          {product.lead_time && <p className="text-muted">{product.lead_time} from confirmation.</p>}
        </div>
      )}

      <CustomSizeDialog open={detailsOpen} onOpenChange={setDetailsOpen} submitting={submitting} onSubmit={(extra) => enquire(extra)} />
      <FallbackDialog result={fallback} onClose={() => setFallback(null)} />
    </div>
  );
}

function WhatsAppGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

function SizeGuide({ chart }: { chart: NonNullable<ProductDetail["size_chart"]> }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-[0.14em] text-royal uppercase">
        <Ruler className="h-3.5 w-3.5" strokeWidth={1.4} /> <span className="link-underline">Size guide</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-midnight/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto bg-ivory p-6 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(40rem,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="display text-3xl text-midnight">{chart.name}</Dialog.Title>
            <Dialog.Close aria-label="Close size guide" className="-mt-2 -mr-2 inline-flex h-11 w-11 items-center justify-center"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-sm text-muted">{chart.description ?? `Measurements in ${chart.unit === "in" ? "inches" : "centimetres"}.`}</Dialog.Description>
          {chart.chart && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[24rem] border-collapse text-sm">
                <caption className="sr-only">Size chart in {chart.unit}</caption>
                <thead>
                  <tr>{chart.chart.columns.map((c) => <th key={c} scope="col" className="border-b border-ink/20 py-2 pr-4 text-left text-[0.68rem] font-semibold tracking-[0.14em] uppercase">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {chart.chart.rows.map((row, i) => (
                    <tr key={i} className="border-b border-line">
                      {row.map((cell, j) => (j === 0 ? <th key={j} scope="row" className="py-2.5 pr-4 text-left font-medium">{cell}</th> : <td key={j} className="py-2.5 pr-4">{cell}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {chart.measurement_guide && (
            <div className="mt-8">
              <h3 className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase">How to measure</h3>
              <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink/80">{chart.measurement_guide.split("\n").map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
          )}
          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            {chart.guide_url && <a href={chart.guide_url} target="_blank" rel="noopener noreferrer" className="text-royal underline underline-offset-4">Download measurement guide (PDF)</a>}
            <Link href="/pages/size-guide" className="text-royal underline underline-offset-4">Full size guide</Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type Extra = { customer?: { name?: string; phone?: string; email?: string }; privacy_consent?: boolean; measurements?: Record<string, string> };

/** Optional measurements and contact details for custom sizing. Never placed in the WhatsApp URL. */
function CustomSizeDialog({ open, onOpenChange, onSubmit, submitting }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (extra: Extra) => void; submitting: boolean }) {
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shared = Object.values(measurements).some(Boolean) || Object.values(contact).some(Boolean);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (shared && !consent) {
      setError("Please agree to the privacy notice to share your details — or leave the fields empty.");
      return;
    }
    setError(null);
    const filled = Object.fromEntries(Object.entries(measurements).filter(([, v]) => v.trim()));
    onSubmit(shared ? { privacy_consent: true, measurements: filled, customer: Object.fromEntries(Object.entries(contact).filter(([, v]) => v.trim())) } : {});
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-midnight/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto bg-ivory p-6 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(36rem,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-10">
          <div className="flex items-start justify-between">
            <Dialog.Title className="display text-3xl text-midnight">Custom size</Dialog.Title>
            <Dialog.Close aria-label="Close" className="-mt-2 -mr-2 inline-flex h-11 w-11 items-center justify-center"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted">
            Share your measurements now (in inches) if you have them — everything here is optional. Our team will request a fitting consultation on WhatsApp either way.
          </Dialog.Description>
          <form onSubmit={submit} className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {MEASUREMENTS.map((m) => (
                <label key={m.key} className="text-sm">
                  <span className="mb-1 block text-xs text-muted">{m.label}</span>
                  <input inputMode="decimal" maxLength={10} value={measurements[m.key] ?? ""} onChange={(e) => setMeasurements((s) => ({ ...s, [m.key]: e.target.value }))} className="h-11 w-full border border-line-strong bg-paper px-3" />
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["name", "phone", "email"] as const).map((field) => (
                <label key={field} className="text-sm">
                  <span className="mb-1 block text-xs text-muted capitalize">{field} (optional)</span>
                  <input type={field === "email" ? "email" : field === "phone" ? "tel" : "text"} autoComplete={field === "phone" ? "tel" : field} value={contact[field]} onChange={(e) => setContact((s) => ({ ...s, [field]: e.target.value }))} className="h-11 w-full border border-line-strong bg-paper px-3" />
                </label>
              ))}
            </div>
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-royal" />
              <span>I agree that my details may be stored to respond to this enquiry, as described in the <Link href="/pages/privacy-policy" className="text-royal underline">privacy policy</Link>.</span>
            </label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={submitting} className="flex min-h-14 w-full items-center justify-center gap-2 bg-midnight text-[0.72rem] font-semibold tracking-[0.2em] text-ivory uppercase disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Continue to WhatsApp
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Shown when WhatsApp is not configured: the enquiry is saved and the visitor is told how we will respond. */
export function FallbackDialog({ result, onClose }: { result: EnquiryResult | null; onClose: () => void }) {
  return (
    <Dialog.Root open={!!result} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-midnight/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(32rem,92vw)] -translate-x-1/2 -translate-y-1/2 bg-ivory p-8">
          <Dialog.Title className="display text-3xl text-midnight">Your enquiry is noted</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted">
            Reference <strong className="text-ink">{result?.reference}</strong>. WhatsApp enquiries are temporarily unavailable — please contact us with this reference and our team will help.
          </Dialog.Description>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/contact" className="inline-flex min-h-12 items-center bg-midnight px-6 text-[0.7rem] font-semibold tracking-[0.18em] text-ivory uppercase">Contact us</Link>
            <button type="button" onClick={() => result && navigator.clipboard.writeText(result.message).then(() => toast("Enquiry details copied"))} className="inline-flex min-h-12 items-center border border-ink/30 px-6 text-[0.7rem] font-semibold tracking-[0.18em] uppercase">Copy details</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
