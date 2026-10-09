import type { Metadata } from "next";
import { WishlistView } from "@/components/store/wishlist-view";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false, follow: false } };

export default function WishlistPage() {
  return (
    <div className="container-editorial pt-10 pb-24 sm:pt-14">
      <h1 className="display text-display text-midnight">Wishlist</h1>
      <p className="mt-3 max-w-xl text-muted">Designs you have saved on this device. Choose a size and colour on each design to enquire.</p>
      <WishlistView />
    </div>
  );
}
