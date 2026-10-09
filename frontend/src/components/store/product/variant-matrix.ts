import type { ProductDetail, Variant } from "@/lib/types";

/**
 * Size/colour availability is derived from real variant rows only — a colour being offered never
 * implies every size exists in it. Pure functions so they can be unit-tested.
 */
export function findVariant(variants: Variant[], sizeId: number | null, colorId: number | null): Variant | undefined {
  return variants.find((v) => v.size_id === sizeId && v.color_id === colorId);
}

export type OptionState = { exists: boolean; enquirable: boolean };

export function sizeStates(product: Pick<ProductDetail, "variants" | "options">, colorId: number | null): Map<number, OptionState> {
  const states = new Map<number, OptionState>();
  for (const size of product.options.sizes) {
    const matches = product.variants.filter((v) => v.size_id === size.id && (colorId === null || v.color_id === colorId));
    states.set(size.id, { exists: matches.length > 0, enquirable: matches.some((v) => v.is_enquirable) });
  }
  return states;
}

export function colorStates(product: Pick<ProductDetail, "variants" | "options">): Map<number, OptionState> {
  const states = new Map<number, OptionState>();
  for (const color of product.options.colors) {
    const matches = product.variants.filter((v) => v.color_id === color.id);
    states.set(color.id, { exists: matches.length > 0, enquirable: matches.some((v) => v.is_enquirable) });
  }
  return states;
}

/** Sensible starting selection: the first enquirable variant (or nothing when none are available). */
export function initialSelection(product: Pick<ProductDetail, "variants" | "options">): { colorId: number | null; sizeId: number | null } {
  const hasColors = product.options.colors.length > 0;
  const hasSizes = product.options.sizes.length > 0;
  const firstAvailable = product.variants.find((v) => v.is_enquirable) ?? product.variants[0];
  return {
    colorId: hasColors ? (firstAvailable?.color_id ?? null) : null,
    // Preselect the size only when there is exactly one (e.g. Free Size); otherwise let the visitor choose.
    sizeId: hasSizes && product.options.sizes.length === 1 ? product.options.sizes[0].id : null,
  };
}

export type SelectionResult =
  | { status: "ready"; variant: Variant | null }
  | { status: "incomplete"; message: string }
  | { status: "unavailable"; message: string };

export function resolveSelection(
  product: Pick<ProductDetail, "variants" | "options" | "allows_custom_size">,
  sizeId: number | null,
  colorId: number | null,
  customSize: boolean,
): SelectionResult {
  const needsColor = product.options.colors.length > 0;
  const needsSize = product.options.sizes.length > 0;

  if (product.variants.length === 0) return { status: "ready", variant: null };
  if (needsColor && colorId === null) return { status: "incomplete", message: "Please choose a colour." };
  if (customSize) {
    return product.allows_custom_size ? { status: "ready", variant: null } : { status: "unavailable", message: "Custom sizing is not offered for this design." };
  }
  if (needsSize && sizeId === null) return { status: "incomplete", message: "Please choose a size." };

  const variant = findVariant(product.variants, needsSize ? sizeId : null, needsColor ? colorId : null);
  if (!variant) return { status: "unavailable", message: "This size is not made in the selected colour." };
  if (!variant.is_enquirable) return { status: "unavailable", message: "This size and colour is currently unavailable." };
  return { status: "ready", variant };
}
