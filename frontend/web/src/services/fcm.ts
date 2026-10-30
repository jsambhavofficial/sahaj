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

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Real FCM registration token from the Firebase SDK (what the backend's FCM sender needs). */
async function getFcmToken(registration: ServiceWorkerRegistration | null): Promise<string | null> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!registration || !vapidKey || !firebaseConfig.apiKey || !firebaseConfig.appId) return null;
  try {
    const { initializeApp, getApps, getApp } = await import("firebase/app");
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return null;
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return (await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration })) || null;
  } catch (err) {
    console.warn("[Push] Could not get an FCM token:", err);
    return null;
  }
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

    const token = await getFcmToken(swRegistration);
    if (!token) {
      return { supported: true, permission: "granted", error: "Push is not configured for this browser (missing Firebase settings)." };
    }
    localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);

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
