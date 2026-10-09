"use client";

import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import type { ProductDetail } from "@/lib/types";
import { ProductGallery } from "./product-gallery";
import { PurchasePanel } from "./purchase-panel";

/** Client shell linking colour selection to the gallery; everything else is server-rendered. */
export function ProductView({ product }: { product: ProductDetail }) {
  const items = useMemo(() => {
    const gallery: { id: number | string; media: (typeof product.gallery)[number]["media"]; colorCode: string | null }[] = product.gallery
      .filter((g) => g.media.kind === "image")
      .map((g) => ({ id: g.id, media: g.media, colorCode: g.color_code }));
    // Variant-specific images not already in the gallery are appended so colour selection can show them.
    const seen = new Set(gallery.map((g) => g.media.id));
    for (const v of product.variants) {
      if (v.image && !seen.has(v.image.id)) {
        seen.add(v.image.id);
        gallery.push({ id: `v${v.id}`, media: v.image, colorCode: product.options.colors.find((c) => c.id === v.color_id)?.code ?? null });
      }
    }
    return gallery;
  }, [product]);
  const [focus, setFocus] = useState(0);

  useEffect(() => {
    track("view_item", { product_id: product.id, item_name: product.name, price_mode: product.price_mode, value: product.price ?? undefined, currency: product.currency });
  }, [product.id, product.name, product.price_mode, product.price, product.currency]);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 xl:gap-24">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <ProductGallery items={items} name={product.name} focusIndex={focus} />
      </div>
      <div className="lg:py-4">
        <PurchasePanel
          product={product}
          onColorChange={(code, imageId) => {
            const index = items.findIndex((i) => (imageId ? i.media.id === imageId : code && i.colorCode === code));
            if (index >= 0) setFocus(index);
          }}
        />
      </div>
    </div>
  );
}
