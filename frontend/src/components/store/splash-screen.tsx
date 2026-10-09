"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Splash screen for native app feel on initial load.
 * Shows briefly while the app hydrates and loads initial data.
 */
export function SplashScreen({ brandName = "Grace New Designers" }: { brandName?: string }) {
  const [isHidden, setIsHidden] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // Hide splash after a short delay to ensure content is ready
    const hideTimer = setTimeout(() => {
      setIsHidden(true);
    }, 800);

    // Remove from DOM after animation completes
    const removeTimer = setTimeout(() => {
      setShouldRender(false);
    }, 1200);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ivory transition-opacity duration-400 lg:hidden",
        isHidden ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
    >
      <div className="space-y-6 text-center">
        {/* Logo animation */}
        <div className={cn(
          "transition-all duration-700 ease-out",
          isHidden ? "scale-110 opacity-0" : "scale-100 opacity-100"
        )}>
          <h1 className="display text-4xl text-midnight">{brandName}</h1>
        </div>

        {/* Loading indicator */}
        <div className="flex justify-center">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-line">
            <div className={cn(
              "h-full bg-royal transition-all duration-700 ease-out",
              isHidden ? "w-full" : "w-0"
            )} />
          </div>
        </div>

        {/* Tagline */}
        <p className={cn(
          "eyebrow text-muted transition-all duration-500 delay-200",
          isHidden ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        )}>
          Modern Indian Couture
        </p>
      </div>
    </div>
  );
}
