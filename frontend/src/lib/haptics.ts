/**
 * Haptic feedback utilities for native app feel on mobile devices.
 * Uses the Vibration API for Android and visual/audio feedback cues for iOS.
 */

type HapticStyle = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

const hapticPatterns: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  selection: 5,
  success: [10, 50, 10],
  warning: [15, 50, 15, 50, 15],
  error: [20, 100, 20],
};

/**
 * Trigger haptic feedback if supported by the device.
 * On iOS, this falls back to visual feedback (scale animations already in CSS).
 * On Android, uses the Vibration API.
 */
export function triggerHaptic(style: HapticStyle = "light"): void {
  // Check if running in browser and vibration is supported
  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  const pattern = hapticPatterns[style];
  
  try {
    navigator.vibrate(pattern);
  } catch (error) {
    // Silently fail - haptics are a progressive enhancement
    console.debug("Haptic feedback not available:", error);
  }
}

/**
 * Hook for haptic feedback in React components
 */
export function useHaptics() {
  const light = () => triggerHaptic("light");
  const medium = () => triggerHaptic("medium");
  const heavy = () => triggerHaptic("heavy");
  const selection = () => triggerHaptic("selection");
  const success = () => triggerHaptic("success");
  const warning = () => triggerHaptic("warning");
  const error = () => triggerHaptic("error");

  return {
    light,
    medium,
    heavy,
    selection,
    success,
    warning,
    error,
    trigger: triggerHaptic,
  };
}

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return typeof window !== "undefined" && "vibrate" in navigator;
}
