"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  enableSnap?: boolean;
  showScrollIndicator?: boolean;
};

/**
 * Mobile-optimized scroll container with:
 * - Smooth momentum scrolling
 * - Optional scroll snap
 * - Scroll position indicators
 * - Touch-friendly interactions
 */
export function MobileScrollContainer({ 
  children, 
  className, 
  enableSnap = false,
  showScrollIndicator = false 
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !showScrollIndicator) return;

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    };

    checkScroll();
    container.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    return () => {
      container.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [showScrollIndicator]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={cn(
          "overflow-x-auto scrollbar-none overscroll-contain",
          enableSnap && "scroll-snap-x",
          className
        )}
      >
        {children}
      </div>
      
      {showScrollIndicator && canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-ivory to-transparent lg:hidden" />
      )}
      
      {showScrollIndicator && canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-ivory to-transparent lg:hidden" />
      )}
    </div>
  );
}

type CardProps = {
  children: React.ReactNode;
  className?: string;
  snap?: boolean;
};

/**
 * Card component optimized for horizontal scrolling on mobile
 */
export function MobileScrollCard({ children, className, snap = true }: CardProps) {
  return (
    <div className={cn("flex-none", snap && "scroll-snap-start", className)}>
      {children}
    </div>
  );
}
