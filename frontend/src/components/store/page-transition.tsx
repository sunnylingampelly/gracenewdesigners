"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Page transition wrapper for native app-like navigation feel.
 * Provides smooth fade transitions between routes on mobile.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayPath, setDisplayPath] = useState(pathname);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (pathname !== displayPath) {
      setIsTransitioning(true);
      
      // Short fade out
      const fadeOutTimer = setTimeout(() => {
        setDisplayPath(pathname);
      }, 150);

      // Fade back in
      const fadeInTimer = setTimeout(() => {
        setIsTransitioning(false);
      }, 200);

      return () => {
        clearTimeout(fadeOutTimer);
        clearTimeout(fadeInTimer);
      };
    }
  }, [pathname, displayPath]);

  return (
    <div
      className={cn(
        "transition-opacity duration-200 ease-out",
        isTransitioning ? "opacity-0" : "opacity-100"
      )}
    >
      {children}
    </div>
  );
}

/**
 * Animated view transition for modal/drawer-style components
 */
export function SlideUpTransition({ 
  isOpen, 
  children,
  onClose,
}: { 
  isOpen: boolean; 
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-midnight/40 transition-opacity duration-300 lg:hidden",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      
      {/* Content */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-ivory shadow-[var(--shadow-lift)] transition-transform duration-300 ease-out lg:hidden",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Handle bar for swipe gesture indicator */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-12 rounded-full bg-line" />
        </div>
        {children}
      </div>
    </>
  );
}

/**
 * Fade transition for overlays and dialogs
 */
export function FadeTransition({ 
  isOpen, 
  children,
  duration = 200,
}: { 
  isOpen: boolean; 
  children: React.ReactNode;
  duration?: number;
}) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        "transition-opacity",
        isOpen ? "opacity-100" : "opacity-0"
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Scale and fade transition for items (product cards, etc.)
 */
export function ScaleInTransition({ 
  children,
  delay = 0,
  className,
}: { 
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        isVisible 
          ? "scale-100 opacity-100" 
          : "scale-95 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}
