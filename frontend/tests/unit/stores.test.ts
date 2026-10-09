import { beforeEach, describe, expect, it } from "vitest";
import { bagKey, MAX_QUANTITY, useBag, useWishlist } from "@/lib/stores";

const item = {
  productId: 1, slug: "midnight-lehenga", name: "Midnight Lehenga", sku: "GND-LH-001", imageUrl: null, imageAlt: "",
  variantId: 11, variantSku: "GND-LH-001-M-NVY", colorId: 10, sizeLabel: "M", colorLabel: "Navy", customSize: false,
  quantity: 1, priceMode: "fixed" as const, unitPrice: 24999, priceLabel: "₹24,999",
};

describe("enquiry bag", () => {
  beforeEach(() => useBag.setState({ items: [] }));

  it("merges the same variant and caps the quantity", () => {
    useBag.getState().add(item);
    useBag.getState().add({ ...item, quantity: 20 });
    expect(useBag.getState().items).toHaveLength(1);
    expect(useBag.getState().items[0].quantity).toBe(MAX_QUANTITY);
  });

  it("keeps different variants and custom-size requests separate", () => {
    useBag.getState().add(item);
    useBag.getState().add({ ...item, variantId: 12 });
    useBag.getState().add({ ...item, variantId: null, customSize: true });
    expect(useBag.getState().items).toHaveLength(3);
    expect(bagKey({ productId: 1, variantId: null, colorId: 10, customSize: true })).toBe("1:-:10:custom");
  });

  it("updates quantities within bounds and removes items", () => {
    useBag.getState().add(item);
    const key = useBag.getState().items[0].key;
    useBag.getState().setQuantity(key, 0);
    expect(useBag.getState().items[0].quantity).toBe(1);
    useBag.getState().remove(key);
    expect(useBag.getState().items).toHaveLength(0);
  });

  it("persists to localStorage under a versioned key", () => {
    useBag.getState().add(item);
    const stored = JSON.parse(localStorage.getItem("gnd-bag") ?? "{}");
    expect(stored.version).toBe(1);
    expect(stored.state.items[0].sku).toBe("GND-LH-001");
  });
});

describe("wishlist", () => {
  beforeEach(() => useWishlist.setState({ items: [] }));

  it("toggles products", () => {
    const entry = { id: 5, slug: "saree", name: "Saree", price_label: "₹1", category: null, imageUrl: null, imageAlt: "" };
    expect(useWishlist.getState().toggle(entry)).toBe(true);
    expect(useWishlist.getState().has(5)).toBe(true);
    expect(useWishlist.getState().toggle(entry)).toBe(false);
    expect(useWishlist.getState().items).toHaveLength(0);
  });
});
