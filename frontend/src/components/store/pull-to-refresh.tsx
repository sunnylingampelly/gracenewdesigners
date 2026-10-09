"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onRefresh: () => Promise<void>;
  threshold?: number;
  children: React.ReactNode;
};

/**
 * Pull-to-refresh component for mobile native app feel.
 * Triggers refresh action when user pulls down from top of page.
 */
export function PullToRefresh({ onRefresh, threshold = 80, children }: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);

  useEffect(() => {
    // Only enable on touch devices
    if (!("ontouchstart" in window)) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only activate if at top of page
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startY.current);

      // Apply resistance curve for natural feel
      const resistance = Math.min(distance / 2.5, threshold * 1.5);
      setPullDistance(resistance);

      // Prevent default scroll if pulling
      if (distance > 10 && window.scrollY === 0) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current) return;

      isPulling.current = false;

      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 0 || isRefreshing;

  return (
    <div className="relative">
      {/* Pull indicator */}
      <div
        className={cn(
          "fixed top-16 left-0 right-0 z-30 flex items-center justify-center transition-all lg:hidden",
          showIndicator ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{
          transform: `translateY(${Math.min(pullDistance, threshold)}px)`,
        }}
      >
        <div className="flex flex-col items-center gap-2 rounded-full bg-ivory/95 px-5 py-3 shadow-soft backdrop-blur-sm">
          <RefreshCw
            className={cn(
              "h-5 w-5 text-royal transition-transform",
              isRefreshing && "animate-spin"
            )}
            style={{
              transform: !isRefreshing ? `rotate(${progress * 360}deg)` : undefined,
            }}
          />
          <span className="text-[0.65rem] font-medium tracking-wide text-muted">
            {isRefreshing ? "Refreshing..." : progress >= 1 ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>

      {children}
    </div>
  );
}
