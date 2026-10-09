import { describe, expect, it } from "vitest";
import { colorStates, findVariant, initialSelection, resolveSelection, sizeStates } from "@/components/store/product/variant-matrix";
import type { ProductDetail, Variant } from "@/lib/types";

const v = (id: number, size: number | null, color: number | null, availability: Variant["availability"] = "in_stock"): Variant => ({
  id, sku: `SKU-${id}`, size_id: size, color_id: color, price: 1000, price_label: "₹1,000", compare_at_price: null,
  availability, availability_label: availability, is_enquirable: availability !== "out_of_stock", image: null,
});

// Sizes S(1) M(2) L(3); colours Navy(10) Ivory(20). Ivory exists only in M. Navy L is sold out.
const product = {
  allows_custom_size: false,
  options: {
    sizes: [{ id: 1, code: "s", label: "S", group: null }, { id: 2, code: "m", label: "M", group: null }, { id: 3, code: "l", label: "L", group: null }],
    colors: [{ id: 10, code: "navy", label: "Navy", hex: "#102E55" }, { id: 20, code: "ivory", label: "Ivory", hex: "#F4EFE3" }],
  },
  variants: [v(1, 1, 10), v(2, 2, 10), v(3, 3, 10, "out_of_stock"), v(4, 2, 20)],
} satisfies Pick<ProductDetail, "variants" | "options" | "allows_custom_size">;

describe("variant matrix", () => {
  it("only offers sizes that exist in the selected colour", () => {
    const ivory = sizeStates(product, 20);
    expect(ivory.get(1)).toEqual({ exists: false, enquirable: false });
    expect(ivory.get(2)).toEqual({ exists: true, enquirable: true });
    expect(ivory.get(3)).toEqual({ exists: false, enquirable: false });
  });

  it("marks sold-out combinations as existing but not enquirable", () => {
    expect(sizeStates(product, 10).get(3)).toEqual({ exists: true, enquirable: false });
  });

  it("never implies a blue/XS-style combination that does not exist", () => {
    expect(findVariant(product.variants, 1, 20)).toBeUndefined();
    expect(resolveSelection(product, 1, 20, false)).toEqual({ status: "unavailable", message: "This size is not made in the selected colour." });
  });

  it("requires size and colour, then resolves the exact variant", () => {
    expect(resolveSelection(product, null, null, false).status).toBe("incomplete");
    expect(resolveSelection(product, null, 10, false)).toEqual({ status: "incomplete", message: "Please choose a size." });
    expect(resolveSelection(product, 2, 10, false)).toEqual({ status: "ready", variant: product.variants[1] });
  });

  it("rejects sold-out variants", () => {
    expect(resolveSelection(product, 3, 10, false).status).toBe("unavailable");
  });

  it("only allows custom size when the product offers it", () => {
    expect(resolveSelection(product, null, 10, true).status).toBe("unavailable");
    expect(resolveSelection({ ...product, allows_custom_size: true }, null, 10, true)).toEqual({ status: "ready", variant: null });
  });

  it("starts on the first available colour without guessing a size", () => {
    expect(initialSelection(product)).toEqual({ colorId: 10, sizeId: null });
    expect(colorStates(product).get(20)).toEqual({ exists: true, enquirable: true });
  });

  it("treats products without variants as directly enquirable", () => {
    expect(resolveSelection({ ...product, variants: [], options: { sizes: [], colors: [] } }, null, null, false)).toEqual({ status: "ready", variant: null });
  });
});
