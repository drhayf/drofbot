/**
 * Push notification utilities — registration, permission, subscription management.
 *
 * Integrates with the service worker registered by vite-plugin-pwa.
 * The actual push event handler lives in the SW (workbox-generated + custom handler).
 */

/** Notification types the user can enable/disable */
export type NotificationType = "briefing" | "cosmic_alert" | "quest_deadline" | "hypothesis_update";

/** All available notification types */
export const NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string }[] =
  [
    {
      type: "briefing",
      label: "Morning & Evening Briefings",
      description: "Daily cosmic weather and reflection prompts",
    },
    {
      type: "cosmic_alert",
      label: "Cosmic Alerts",
      description: "Significant transits, retrogrades, and Kp storms",
    },
    {
      type: "quest_deadline",
      label: "Quest Deadlines",
      description: "Reminders when quests are about to expire",
    },
    {
      type: "hypothesis_update",
      label: "Hypothesis Updates",
      description: "New evidence or confidence changes",
    },
  ];

/**
 * Check whether the browser supports push notifications.
 */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Get the current notification permission state.
 */
export function getPermissionState(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Request notification permission from the user.
 * Returns the resulting permission state.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.requestPermission();
}

/**
 * Get or create a push subscription for the current service worker.
 * The VAPID public key should come from the server/config.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
    return subscription;
  } catch {
    return null;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;

  return subscription.unsubscribe();
}

/**
 * Register the service worker (called from main.tsx).
 * vite-plugin-pwa handles this automatically, but we expose it for testing.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return registration;
  } catch {
    return null;
  }
}

/** Convert a base64 VAPID key to a Uint8Array for the push API. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}
