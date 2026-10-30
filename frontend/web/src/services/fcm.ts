/**
 * Firebase Cloud Messaging & Web Push Client Helper
 * Handles browser notification permissions, Service Worker registration,
 * and device token syncing with Sahaj AI backend.
 */
import { getDataService } from "./index";

const FCM_TOKEN_STORAGE_KEY = "sahaj_fcm_device_token";

export interface PushRegistrationResult {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  token?: string;
  error?: string;
}

/**
 * Convert URL-safe base64 string to Uint8Array for PushManager subscription.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the current browser environment supports Push Notifications and Service Workers.
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/**
 * Register Service Worker for background Web Push.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    return registration;
  } catch (err) {
    console.warn("[Push] Service Worker registration failed:", err);
    return null;
  }
}

/**
 * Request Notification permissions and register device token with backend.
 */
export async function registerWebPushToken(): Promise<PushRegistrationResult> {
  if (!isPushNotificationSupported()) {
    return { supported: false, permission: "unsupported" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { supported: true, permission };
    }

    // Register service worker
    const swRegistration = await registerServiceWorker();

    let token = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    // If VAPID public key is configured, create or get standard Web Push subscription
    if (swRegistration && "pushManager" in swRegistration && vapidKey) {
      try {
        let subscription = await swRegistration.pushManager.getSubscription();
        if (!subscription) {
          const applicationServerKey = urlBase64ToUint8Array(vapidKey);
          subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as unknown as BufferSource,
          });
        }
        if (subscription) {
          const jsonSub = subscription.toJSON();
          // Use endpoint or full serialized subscription token
          token = jsonSub.endpoint || JSON.stringify(jsonSub);
          localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
        }
      } catch (e) {
        console.warn("[Push] VAPID subscription failed, fallback to client token:", e);
      }
    }

    if (!token) {
      // Fallback unique web client device token
      token = `web_fcm_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
    }

    // Register token with backend
    try {
      const dataService = getDataService();
      await dataService.registerDevice({
        platform: "web",
        token,
        app_version: "2.0.0-web",
      });
    } catch (err) {
      console.warn("[Push] Backend device registration warning:", err);
    }

    return { supported: true, permission: "granted", token };
  } catch (error: any) {
    console.error("[Push] Token registration error:", error);
    return {
      supported: true,
      permission: Notification.permission,
      error: error?.message || "Registration failed",
    };
  }
}

/**
 * Retrieve the current stored device token if any.
 */
export function getStoredDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
}
