"use client";

import { useEffect, useState } from "react";
import { Check, X, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

const icons = {
  success: Check,
  error: X,
  warning: AlertCircle,
  info: Info,
};

const styles = {
  success: "bg-success/10 text-success border-success/20",
  error: "bg-danger/10 text-danger border-danger/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  info: "bg-royal/10 text-royal border-royal/20",
};

/**
 * Mobile-optimized toast notification system.
 * Positioned at bottom of screen (above bottom nav) for easy thumb access.
 */
export function MobileToast({ 
  message, 
  type = "info", 
  onClose,
  duration = 3000 
}: { 
  message: string; 
  type?: ToastType; 
  onClose: () => void;
  duration?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = icons[type];

  useEffect(() => {
    // Trigger animation after mount
    requestAnimationFrame(() => setIsVisible(true));

    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={cn(
        "fixed bottom-20 left-4 right-4 z-[100] flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lift backdrop-blur-sm transition-all duration-300 lg:hidden",
        styles[type],
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
      role="alert"
      aria-live="polite"
    >
      <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={handleClose}
        className="flex-shrink-0 p-1 hover:opacity-70 active:scale-95"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Hook to manage mobile toast notifications
 */
export function useMobileToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = (message: string, type: ToastType = "info", duration = 3000) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  };

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toast = {
    success: (message: string, duration?: number) => show(message, "success", duration),
    error: (message: string, duration?: number) => show(message, "error", duration),
    warning: (message: string, duration?: number) => show(message, "warning", duration),
    info: (message: string, duration?: number) => show(message, "info", duration),
  };

  const ToastContainer = () => (
    <>
      {toasts.map((t) => (
        <MobileToast
          key={t.id}
          message={t.message}
          type={t.type}
          duration={t.duration}
          onClose={() => remove(t.id)}
        />
      ))}
    </>
  );

  return { toast, ToastContainer };
}
