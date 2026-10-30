// Service Worker for Firebase Cloud Messaging & Web Push
// Sahaj AI Push Notification System

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming background push notifications
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      payload = { notification: { body: event.data.text() } };
    } catch {
      payload = {};
    }
  }

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || "सहज AI सूचना";
  const body = notification.body || data.body || "आपके पास एक नई सूचना है।";
  const icon = notification.icon || "/icons/icon-192.png";
  const badge = notification.badge || "/icons/badge-72.png";
  const tag = data.notification_id || data.kind || "sahaj-notification";

  const options = {
    body,
    icon,
    badge,
    tag,
    data: {
      url: data.click_action || data.url || "/notifications",
      record_id: data.senior_id || data.alert_id || data.visit_id || data.task_id,
      ...data,
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click to navigate user to relevant record or portal
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const clickData = event.notification.data || {};
  let targetUrl = clickData.url || "/";

  // Deep linking logic based on data payload
  if (clickData.senior_id && !targetUrl.includes(clickData.senior_id)) {
    if (clickData.kind && clickData.kind.startsWith("wellbeing_concern")) {
      targetUrl = `/caretaker/concerns?senior_id=${encodeURIComponent(clickData.senior_id)}`;
    } else if (clickData.kind && clickData.kind.includes("visit")) {
      targetUrl = `/caretaker/visits?senior_id=${encodeURIComponent(clickData.senior_id)}`;
    } else {
      targetUrl = `/senior/notifications`;
    }
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

