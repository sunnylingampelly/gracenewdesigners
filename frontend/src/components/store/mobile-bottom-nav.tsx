"use client";

import { Heart, Home, Search, ShoppingBag, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBag, useHydrated, useWishlist } from "@/lib/stores";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type Props = {
  onSearchOpen: () => void;
};

/**
 * Bottom navigation bar for mobile devices following iOS/Android native app patterns.
 * Provides quick access to primary actions: Home, Shop, Search, Wishlist, and Bag.
 */
export function MobileBottomNav({ onSearchOpen }: Props) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const bagCount = useBag((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const wishCount = useWishlist((s) => s.items.length);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-ivory/95 backdrop-blur-xl supports-[backdrop-filter]:bg-ivory/90 lg:hidden safe-area-inset-bottom"
      aria-label="Mobile bottom navigation"
    >
      <div className="grid grid-cols-5 h-16">
        {/* Home */}
        <NavItem
          href="/"
          icon={Home}
          label="Home"
          isActive={isActive("/")}
        />

        {/* Shop */}
        <NavItem
          href="/shop"
          icon={Store}
          label="Shop"
          isActive={isActive("/shop") || isActive("/products") || isActive("/collections")}
        />

        {/* Search */}
        <NavButton
          onClick={onSearchOpen}
          icon={Search}
          label="Search"
          isActive={false}
        />

        {/* Wishlist */}
        <NavItem
          href="/wishlist"
          icon={Heart}
          label="Wishlist"
          isActive={isActive("/wishlist")}
          badge={hydrated ? wishCount : undefined}
        />

        {/* Bag */}
        <NavItem
          href="/bag"
          icon={ShoppingBag}
          label="Bag"
          isActive={isActive("/bag")}
          badge={hydrated ? bagCount : undefined}
        />
      </div>
    </nav>
  );
}

type NavItemProps = {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  isActive: boolean;
  badge?: number;
};

function NavItem({ href, icon: Icon, label, isActive, badge }: NavItemProps) {
  const handleClick = () => {
    triggerHaptic("selection");
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 transition-colors active:scale-95",
        isActive ? "text-royal" : "text-muted hover:text-ink"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <div className="relative">
        <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-royal px-1 text-[0.6rem] font-semibold text-ivory">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        {isActive && (
          <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-royal" />
        )}
      </div>
      <span className={cn(
        "text-[0.65rem] font-medium tracking-tight",
        isActive && "font-semibold"
      )}>
        {label}
      </span>
    </Link>
  );
}

type NavButtonProps = {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  isActive: boolean;
};

function NavButton({ onClick, icon: Icon, label, isActive }: NavButtonProps) {
  const handleClick = () => {
    triggerHaptic("light");
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 transition-colors active:scale-95",
        isActive ? "text-royal" : "text-muted hover:text-ink"
      )}
    >
      <div className="relative">
        <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
        {isActive && (
          <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-royal" />
        )}
      </div>
      <span className={cn(
        "text-[0.65rem] font-medium tracking-tight",
        isActive && "font-semibold"
      )}>
        {label}
      </span>
    </button>
  );
}
