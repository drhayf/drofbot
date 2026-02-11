import { X } from "lucide-react";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { TIMING } from "../../utils/animations";

type ToastVariant = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  exiting?: boolean;
}

const variantClasses: Record<ToastVariant, string> = {
  info: "bg-surface-raised border-border text-ink-1",
  success: "bg-surface-raised border-positive/30 text-positive",
  warning: "bg-surface-raised border-caution/30 text-caution",
  error: "bg-surface-raised border-negative/30 text-negative",
};

/** Global toast state — simple pub/sub for cross-component access */
type ToastListener = (toast: ToastItem) => void;
const listeners: Set<ToastListener> = new Set();

/**
 * Show a toast notification from anywhere in the app.
 */
export function showToast(message: string, variant: ToastVariant = "info"): void {
  const toast: ToastItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    message,
    variant,
  };
  for (const listener of listeners) {
    listener(toast);
  }
}

/**
 * Toast container — renders at app root, manages stack of active toasts.
 * Slides in from top-right, auto-dismisses after TIMING.toastDismiss.
 */
export function ToastContainer(): ReactNode {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: ToastItem) => {
    setToasts((prev) => [...prev, toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TIMING.fast);
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => {
      listeners.delete(addToast);
    };
  }, [addToast]);

  // Auto-dismiss
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const toast of toasts) {
      if (!toast.exiting) {
        timers.push(setTimeout(() => removeToast(toast.id), TIMING.toastDismiss));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-card border shadow-elevated text-sm font-body
            ${variantClasses[toast.variant]}
            ${toast.exiting ? "animate-toast-out" : "animate-toast-in"}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-ink-3 hover:text-ink-1 transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
