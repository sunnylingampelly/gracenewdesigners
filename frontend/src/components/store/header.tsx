"use client";

import { Heart, Menu, Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavItem, PublicSettings } from "@/lib/types";
import { useBag, useHydrated, useWishlist } from "@/lib/stores";
import { cn } from "@/lib/utils";
import { MediaImage } from "@/components/media/media-image";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { SearchOverlay } from "./search-overlay";

type Props = { items: NavItem[]; settings: PublicSettings; secondary: NavItem[] };

export function Header({ items, settings, secondary }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useHydrated();
  const bagCount = useBag((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const wishCount = useWishlist((s) => s.items.length);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus on navigation (state adjusted during render rather than in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(null);
    setMobileOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement))) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openMenu = (id: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(id);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 140);
  };

  const active = items.find((i) => i.id === open);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 border-b bg-ivory/95 backdrop-blur-sm transition-[box-shadow,border-color] duration-300 supports-[backdrop-filter]:bg-ivory/85",
          scrolled ? "border-line shadow-[0_1px_0_rgb(8_27_51_/_0.03)]" : "border-transparent",
        )}
        onMouseLeave={scheduleClose}
      >
        <div className="container-editorial">
          <div className={cn("grid grid-cols-[1fr_auto_1fr] items-center transition-[height] duration-300", scrolled ? "h-16" : "h-16 lg:h-20")}>
            {/* Left: mobile menu / desktop search */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="-ml-2 inline-flex h-11 w-11 items-center justify-center lg:hidden"
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" strokeWidth={1.4} />
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="group hidden items-center gap-3 py-2 text-[0.8rem] tracking-[0.08em] text-muted transition-colors hover:text-ink lg:inline-flex"
              >
                <Search className="h-4 w-4" strokeWidth={1.4} />
                <span className="link-underline">Search</span>
              </button>
            </div>

            <Logo brandName={settings.brand_name} logo={settings.logo_light_bg ?? settings.logo_primary} mobileLogo={settings.logo_mobile} height={scrolled ? 34 : 42} />

            {/* Right: icons */}
            <div className="flex items-center justify-end gap-0.5 sm:gap-2">
              <Link href="/contact" className="hidden px-2 py-2 text-[0.8rem] tracking-[0.08em] text-muted transition-colors hover:text-ink xl:inline-block">
                <span className="link-underline">Contact</span>
              </Link>
              <button type="button" onClick={() => setSearchOpen(true)} className="inline-flex h-11 w-11 items-center justify-center lg:hidden" aria-label="Search">
                <Search className="h-5 w-5" strokeWidth={1.4} />
              </button>
              <Link href="/wishlist" className="relative inline-flex h-11 w-11 items-center justify-center" aria-label={`Wishlist${hydrated && wishCount ? `, ${wishCount} saved` : ""}`}>
                <Heart className="h-5 w-5" strokeWidth={1.4} />
                {hydrated && wishCount > 0 && <CountBadge value={wishCount} />}
              </Link>
              <Link href="/bag" className="relative -mr-2 inline-flex h-11 w-11 items-center justify-center" aria-label={`Enquiry bag${hydrated && bagCount ? `, ${bagCount} items` : ""}`}>
                <ShoppingBag className="h-5 w-5" strokeWidth={1.4} />
                {hydrated && bagCount > 0 && <CountBadge value={bagCount} />}
              </Link>
            </div>
          </div>

          {/* Desktop primary navigation */}
          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center justify-center gap-9 pb-3">
              {items.map((item) => (
                <li key={item.id} onMouseEnter={() => (item.children.length ? openMenu(item.id) : setOpen(null))}>
                  {item.children.length ? (
                    <button
                      type="button"
                      aria-expanded={open === item.id}
                      aria-controls={`mega-${item.id}`}
                      onClick={() => setOpen(open === item.id ? null : item.id)}
                      className={cn(
                        "relative py-2 text-[0.72rem] font-semibold tracking-[0.2em] uppercase transition-colors",
                        open === item.id ? "text-royal" : "text-ink hover:text-royal",
                      )}
                    >
                      {item.label}
                      <span className={cn("absolute inset-x-0 -bottom-0.5 h-px origin-left bg-royal transition-transform duration-300", open === item.id ? "scale-x-100" : "scale-x-0")} />
                    </button>
                  ) : (
                    <NavLink item={item} className="relative block py-2 text-[0.72rem] font-semibold tracking-[0.2em] text-ink uppercase transition-colors hover:text-royal" />
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Mega menu */}
        {active && active.children.length > 0 && (
          <div
            id={`mega-${active.id}`}
            className="absolute inset-x-0 top-full hidden border-t border-line bg-paper shadow-[var(--shadow-lift)] lg:block animate-fade-in"
            onMouseEnter={() => openMenu(active.id)}
            onMouseLeave={scheduleClose}
          >
            <MegaMenu item={active} onNavigate={() => setOpen(null)} />
          </div>
        )}
      </header>

      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} items={items} secondary={secondary} settings={settings} />
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

function CountBadge({ value }: { value: number }) {
  return (
    <span aria-hidden className="absolute top-1.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy px-1 text-[0.6rem] font-semibold text-ivory">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function NavLink({ item, className, onClick }: { item: NavItem; className?: string; onClick?: () => void }) {
  if (!item.url) return <span className={className}>{item.label}</span>;
  if (item.external || item.url.startsWith("http")) {
    return (
      <a href={item.url} className={className} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined} onClick={onClick}>
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.url} className={className} onClick={onClick}>
      {item.label}
    </Link>
  );
}

function MegaMenu({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const groups = new Map<string, NavItem[]>();
  for (const child of item.children) {
    const key = child.group ?? item.label;
    groups.set(key, [...(groups.get(key) ?? []), child]);
  }
  const feature = item.image ?? item.children.find((c) => c.image)?.image ?? null;

  return (
    <div className="container-editorial grid grid-cols-12 gap-10 py-10">
      <div className="col-span-8 grid grid-cols-3 gap-10">
        {[...groups.entries()].map(([heading, children]) => (
          <div key={heading}>
            <p className="eyebrow mb-5 text-muted">{heading}</p>
            <ul className="space-y-3">
              {children.map((child) => (
                <li key={child.id}>
                  <NavLink item={child} onClick={onNavigate} className="display text-[1.3rem] leading-tight text-ink transition-colors hover:text-royal" />
                  {child.highlight && <span className="ml-2 text-[0.65rem] tracking-[0.15em] text-royal uppercase">{child.highlight}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="col-span-4">
        {feature ? (
          <Link href={item.url ?? "#"} onClick={onNavigate} className="group relative block aspect-[4/5] overflow-hidden bg-ice">
            <MediaImage media={feature} sizes="30vw" fill className="transition-transform duration-[1.2s] ease-[var(--ease-luxe)] group-hover:scale-[1.03]" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-midnight/70 to-transparent p-6 text-ivory">
              <span className="eyebrow block opacity-90">Discover</span>
              <span className="display text-2xl">{item.label}</span>
            </span>
          </Link>
        ) : (
          <div className="flex h-full flex-col justify-end border-l border-line pl-10">
            <p className="eyebrow mb-3 text-muted">{item.label}</p>
            <p className="display text-3xl leading-tight text-midnight">Modern Indian couture, made for your moments.</p>
            {item.url && (
              <Link href={item.url} onClick={onNavigate} className="mt-6 text-[0.75rem] font-semibold tracking-[0.18em] text-royal uppercase">
                <span className="link-underline">Shop all {item.label}</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
