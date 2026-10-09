"use client";

import { useEffect, useRef, TouchEvent } from "react";

type SwipeDirection = "left" | "right" | "up" | "down";

type SwipeCallbacks = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipe?: (direction: SwipeDirection) => void;
};

type SwipeOptions = {
  threshold?: number; // Minimum distance for swipe detection (px)
  velocityThreshold?: number; // Minimum velocity for swipe detection (px/ms)
  maxTime?: number; // Maximum time for swipe gesture (ms)
};

/**
 * Hook for detecting swipe gestures on touch devices.
 * Useful for native app-like interactions (swipe to dismiss, swipe between items, etc.)
 */
export function useSwipe(
  callbacks: SwipeCallbacks,
  options: SwipeOptions = {}
) {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    maxTime = 500,
  } = options;

  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);

  useEffect(() => {
    const handleTouchStart = (e: globalThis.TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      startTime.current = Date.now();
    };

    const handleTouchEnd = (e: globalThis.TouchEvent) => {
      if (!e.changedTouches || e.changedTouches.length === 0) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();

      const deltaX = endX - startX.current;
      const deltaY = endY - startY.current;
      const deltaTime = endTime - startTime.current;

      const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;

      // Check if gesture meets time and velocity requirements
      if (deltaTime > maxTime || velocity < velocityThreshold) {
        return;
      }

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Determine direction based on larger delta
      if (absDeltaX > absDeltaY && absDeltaX > threshold) {
        const direction: SwipeDirection = deltaX > 0 ? "right" : "left";
        callbacks.onSwipe?.(direction);
        if (direction === "left") callbacks.onSwipeLeft?.();
        if (direction === "right") callbacks.onSwipeRight?.();
      } else if (absDeltaY > threshold) {
        const direction: SwipeDirection = deltaY > 0 ? "down" : "up";
        callbacks.onSwipe?.(direction);
        if (direction === "up") callbacks.onSwipeUp?.();
        if (direction === "down") callbacks.onSwipeDown?.();
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [callbacks, threshold, velocityThreshold, maxTime]);
}

/**
 * Hook for detecting swipe on a specific element (ref-based)
 */
export function useSwipeElement(
  callbacks: SwipeCallbacks,
  options: SwipeOptions = {}
) {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    maxTime = 500,
  } = options;

  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);

  const handlers = {
    onTouchStart: (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      startTime.current = Date.now();
    },

    onTouchEnd: (e: TouchEvent) => {
      if (!e.changedTouches || e.changedTouches.length === 0) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();

      const deltaX = endX - startX.current;
      const deltaY = endY - startY.current;
      const deltaTime = endTime - startTime.current;

      const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime;

      if (deltaTime > maxTime || velocity < velocityThreshold) {
        return;
      }

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (absDeltaX > absDeltaY && absDeltaX > threshold) {
        const direction: SwipeDirection = deltaX > 0 ? "right" : "left";
        callbacks.onSwipe?.(direction);
        if (direction === "left") callbacks.onSwipeLeft?.();
        if (direction === "right") callbacks.onSwipeRight?.();
      } else if (absDeltaY > threshold) {
        const direction: SwipeDirection = deltaY > 0 ? "down" : "up";
        callbacks.onSwipe?.(direction);
        if (direction === "up") callbacks.onSwipeUp?.();
        if (direction === "down") callbacks.onSwipeDown?.();
      }
    },
  };

  return handlers;
}
