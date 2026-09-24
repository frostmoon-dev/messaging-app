/* Napyru service worker.
 * - Makes the app installable.
 * - Shows an offline page when navigation fails.
 * - Shows Web Push notifications (sent by the send-push Edge Function).
 * - Focuses the chat when a notification is clicked.
 * Private data is never cached: only the offline page and icons are stored.
 */
const CACHE = "napyru-shell-v14";
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/badge-96.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate") return; // leave API, Supabase and assets alone
  event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
});

// Chromium browsers let a push go without a notification while the app is
// open and focused. Safari and Firefox count that against the site and can
// stop sending pushes, so there we always show it.
const CAN_SKIP_WHEN_FOCUSED = /Chrome\//.test(self.navigator.userAgent) && !/CriOS|EdgiOS|FxiOS/.test(self.navigator.userAgent);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Unreadable payload: fall back to a generic notification.
  }
  const kind = typeof data.kind === "string" ? data.kind : "message";
  const sos = kind === "sos";
  const title = typeof data.title === "string" ? data.title : "Napyru \u2661";
  const body = typeof data.body === "string" ? data.body : "You have a new message";
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/chat";
  const tag = typeof data.tag === "string" ? data.tag : "new-message";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const looking = clients.some((c) => c.focused && c.visibilityState === "visible");
      // Only new-message pops are skipped while you're looking at the app;
      // reminders, alerts and SOS always show.
      if (looking && CAN_SKIP_WHEN_FOCUSED && kind === "message") return;
      return self.registration.showNotification(title, {
        body,
        tag,
        renotify: true,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        // SOS stays on screen until dismissed and buzzes hard; everything
        // else is a short double tap.
        requireInteraction: sos,
        vibrate: sos ? [600, 200, 600, 200, 600, 200, 600] : [80, 40, 80],
        timestamp: Date.now(),
        data: { url, kind },
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/chat", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
