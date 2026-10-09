"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { useHydrated, useWishlist, wishlistItemFromCard } from "@/lib/stores";
import type { ProductCard } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  product: ProductCard;
  className?: string;
  placement?: "card" | "detail";
};

export function WishlistButton({ product, className, placement = "card" }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const saved = useWishlist((s) => s.items.some((i) => i.id === product.id));
  const toggle = useWishlist((s) => s.toggle);
  const active = hydrated && saved;

  const onClick = () => {
    const added = toggle(wishlistItemFromCard(product));
    if (added) track("add_to_wishlist", { product_id: product.id, item_name: product.name });
    toast(added ? "Saved to your wishlist" : "Removed from your wishlist", {
      action: added ? { label: "View", onClick: () => router.push("/wishlist") } : undefined,
    });
  };

  if (placement === "detail") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn("inline-flex min-h-12 items-center justify-center gap-2 border border-ink/25 px-5 text-[0.7rem] font-semibold tracking-[0.18em] uppercase transition-colors hover:border-ink", className)}
      >
        <Heart className={cn("h-4 w-4", active && "fill-royal text-royal")} strokeWidth={1.4} />
        {active ? "Saved" : "Add to Wishlist"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      className={cn("inline-flex h-10 w-10 items-center justify-center", className)}
    >
      <Heart className={cn("h-[18px] w-[18px] transition-colors", active ? "fill-royal text-royal" : "text-ink/70 hover:text-ink")} strokeWidth={1.4} />
    </button>
  );
}
