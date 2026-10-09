"use client";

/* eslint-disable @next/next/no-img-element -- stored rendition URLs */
import { Share2, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useHydrated, useWishlist } from "@/lib/stores";
import { ButtonLink } from "./ui";

export function WishlistView() {
  const hydrated = useHydrated();
  const { items, remove } = useWishlist();

  if (!hydrated) return <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton aspect-[4/5]" />)}</div>;

  if (items.length === 0) {
    return (
      <div className="mt-12 border border-dashed border-line-strong px-6 py-20 text-center">
        <p className="display text-3xl text-midnight">Nothing saved yet</p>
        <p className="mt-3 text-muted">Tap the heart on any design to keep it here.</p>
        <div className="mt-8"><ButtonLink href="/new-arrivals">See New Arrivals</ButtonLink></div>
      </div>
    );
  }

  const shareList = async () => {
    const text = items.map((i) => `${i.name} — ${window.location.origin}/products/${i.slug}`).join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "My Grace New Designers wishlist", text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Wishlist links copied");
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <>
      <div className="mt-8 flex justify-end">
        <button type="button" onClick={shareList} className="inline-flex min-h-11 items-center gap-2 text-[0.7rem] font-semibold tracking-[0.18em] text-royal uppercase">
          <Share2 className="h-4 w-4" strokeWidth={1.4} /> Share list
        </button>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.id} className="relative">
            <Link href={`/products/${item.slug}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden bg-ice">
                {item.imageUrl && <img src={item.imageUrl} alt={item.imageAlt} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
              </div>
              {item.category && <p className="mt-4 text-[0.65rem] font-semibold tracking-[0.18em] text-muted uppercase">{item.category}</p>}
              <p className="display mt-1 text-xl leading-snug">{item.name}</p>
              <p className="text-sm text-ink/80">{item.price_label}</p>
            </Link>
            <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.name} from wishlist`} className="absolute top-2 right-2 inline-flex h-10 w-10 items-center justify-center bg-ivory/90">
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
