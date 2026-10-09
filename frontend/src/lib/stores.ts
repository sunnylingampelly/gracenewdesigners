"use client";

/**
 * Guest bag and wishlist, persisted in localStorage. Each store is versioned so a future
 * customer-account release can migrate and merge guest lists into server-side lists
 * (see docs/architecture.md → "Guest list merge strategy").
 */
import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PriceMode, ProductCard } from "./types";

export type BagItem = {
  key: string;
  productId: number;
  slug: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  imageAlt: string;
  variantId: number | null;
  variantSku: string | null;
  colorId: number | null;
  sizeLabel: string | null;
  colorLabel: string | null;
  customSize: boolean;
  quantity: number;
  priceMode: PriceMode;
  unitPrice: number | null;
  priceLabel: string;
  addedAt: number;
};

export const MAX_QUANTITY = 10;

export function bagKey(item: Pick<BagItem, "productId" | "variantId" | "colorId" | "customSize">): string {
  return [item.productId, item.variantId ?? "-", item.colorId ?? "-", item.customSize ? "custom" : "std"].join(":");
}

type BagState = {
  items: BagItem[];
  add: (item: Omit<BagItem, "key" | "addedAt">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

export const useBag = create<BagState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((state) => {
          const key = bagKey(item);
          const existing = state.items.find((i) => i.key === key);
          if (existing) {
            return {
              items: state.items.map((i) => (i.key === key ? { ...i, quantity: Math.min(MAX_QUANTITY, i.quantity + item.quantity) } : i)),
            };
          }
          return { items: [...state.items, { ...item, key, addedAt: Date.now() }].slice(-20) };
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          items: state.items.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(MAX_QUANTITY, quantity)) } : i)),
        })),
      remove: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    { name: "gnd-bag", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export type WishlistItem = Pick<ProductCard, "id" | "slug" | "name" | "price_label" | "category"> & {
  imageUrl: string | null;
  imageAlt: string;
  addedAt: number;
};

type WishlistState = {
  items: WishlistItem[];
  toggle: (item: Omit<WishlistItem, "addedAt">) => boolean;
  remove: (id: number) => void;
  has: (id: number) => boolean;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (item) => {
        const exists = get().items.some((i) => i.id === item.id);
        set((state) => ({
          items: exists ? state.items.filter((i) => i.id !== item.id) : [{ ...item, addedAt: Date.now() }, ...state.items].slice(0, 100),
        }));
        return !exists;
      },
      remove: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      has: (id) => get().items.some((i) => i.id === id),
    }),
    { name: "gnd-wishlist", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

/** True after the first client render — persisted state is only read after hydration to avoid mismatches. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount flag
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function wishlistItemFromCard(card: ProductCard): Omit<WishlistItem, "addedAt"> {
  return {
    id: card.id,
    slug: card.slug,
    name: card.name,
    price_label: card.price_label,
    category: card.category,
    imageUrl: card.image?.sources.find((s) => s.name === "sm")?.url ?? card.image?.url ?? null,
    imageAlt: card.image?.alt ?? card.name,
  };
}
