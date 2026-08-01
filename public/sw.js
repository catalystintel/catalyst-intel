// Web Push service worker. Free — no FCM/APNs SDK involved; the browser
// wakes this worker directly when a push arrives, even if the tab is closed.

// Activate immediately so pushManager.subscribe() can run on first click
// without requiring a full page reload.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "Catalyst Intel", body: "New catalyst alert", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload — fall back to defaults.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/apple-icon.png",
      badge: "/apple-icon.png",
      data: { url: data.url || "/alerts" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/alerts";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            try {
              const clientUrl = new URL(client.url);
              const target = new URL(url, self.location.origin);
              if (
                clientUrl.origin === target.origin &&
                clientUrl.pathname === target.pathname
              ) {
                return client.focus();
              }
            } catch {
              // Fall through to openWindow.
            }
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
