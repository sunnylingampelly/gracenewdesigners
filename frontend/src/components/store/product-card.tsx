"use client";

import Link from "next/link";
import { MediaImage } from "@/components/media/media-image";
import { track } from "@/lib/analytics";
import type { ProductCard as Card } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WishlistButton } from "./wishlist-button";

type Props = {
  product: Card;
  /** Analytics list name, e.g. "category:women/lehengas". */
  listName?: string;
  index?: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
};

export function ProductCard({ product, listName, index, priority, sizes = "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw", className }: Props) {
  return (
    <article className={cn("group relative", className)}>
      <Link
        href={product.url}
        className="block"
        aria-label={`${product.name}, ${product.price_label}`}
        onClick={() => track("select_item", { product_id: product.id, item_list_name: listName, index })}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-ice">
          <MediaImage
            media={product.image}
            sizes={sizes}
            fill
            priority={priority}
            alt={product.image?.alt || product.name}
            className="transition-[opacity,transform] duration-[900ms] ease-[var(--ease-luxe)] group-hover:scale-[1.02]"
            categorySlug={product.category}
            productId={product.id}
            aspectRatio={0.8}
          />
          {product.hover_image && (
            <MediaImage
              media={product.hover_image}
              sizes={sizes}
              fill
              alt=""
              className="hidden opacity-0 transition-opacity duration-700 ease-[var(--ease-luxe)] group-hover:opacity-100 md:block"
              categorySlug={product.category}
              productId={product.id}
              aspectRatio={0.8}
            />
          )}
          {product.badges.length > 0 && (
            <ul className="absolute top-3 left-3 flex flex-col gap-1.5">
              {product.badges.slice(0, 2).map((badge) => (
                <li key={badge} className="bg-ivory/92 px-2 py-1 text-[0.6rem] font-semibold tracking-[0.18em] text-midnight uppercase">
                  {badge}
                </li>
              ))}
            </ul>
          )}
          {!product.is_available && (
            <span className="absolute inset-x-0 bottom-0 bg-ivory/90 py-2 text-center text-[0.65rem] font-semibold tracking-[0.16em] text-muted uppercase">
              Currently unavailable
            </span>
          )}
        </div>
      </Link>
      <div className="relative">
        <Link href={product.url} className="mt-4 block space-y-1 pr-10" tabIndex={-1} aria-hidden onClick={() => track("select_item", { product_id: product.id, item_list_name: listName, index })}>
          {product.category && <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-muted uppercase">{product.category}</p>}
          <h3 className="display text-[1.2rem] leading-snug text-ink sm:text-[1.3rem]">{product.name}</h3>
          <p className="text-sm text-ink/80">
            {product.compare_at_price && product.price !== null && (
              <span className="mr-2 text-muted line-through">{new Intl.NumberFormat("en-IN", { style: "currency", currency: product.currency, maximumFractionDigits: 0 }).format(product.compare_at_price)}</span>
            )}
            {product.price_label}
          </p>
          {product.colors.length > 1 && (
            <ul className="flex gap-1.5 pt-1" aria-label={`Available in ${product.colors.map((c) => c.label).join(", ")}`}>
              {product.colors.slice(0, 5).map((c) => (
                <li key={c.code} className="h-2.5 w-2.5 rounded-full border border-ink/15" style={{ background: c.hex ?? "#ddd" }} title={c.label} />
              ))}
            </ul>
          )}
        </Link>
        <WishlistButton product={product} className="absolute top-3 -right-2" placement="card" />
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="skeleton aspect-[4/5]" />
      <div className="skeleton mt-4 h-3 w-1/3" />
      <div className="skeleton mt-2 h-5 w-3/4" />
      <div className="skeleton mt-2 h-3 w-1/4" />
    </div>
  );
}
