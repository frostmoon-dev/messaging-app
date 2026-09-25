/* Napyru service worker.
 * - Makes the app installable.
 * - Shows an offline page when navigation fails.
 * - Shows Web Push notifications (sent by the send-push Edge Function).
 *   New messages stack into one pop-up ("Rafie ♡ · 3 new messages").
 * - Focuses the chat when a notification is clicked; a message opens it
 *   with the reply box ready.
 * Private data is never cached: only the offline page and icons are stored.
 */
const CACHE = "napyru-shell-v20";
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

// Pop-ups that the open app already shows in its own way.
const SKIP_WHEN_FOCUSED = new Set(["message", "reaction", "sos_reply", "love"]);
const MESSAGE_TAG = "new-message";
// "Thinking of you": the same lub-dub as the app's haptics.
const HEARTBEAT = [18, 60, 10, 110, 18, 60, 10];
const MAX_LINES = 5;

/**
 * Adds a new message to the message pop-up that is already showing, so
 * three messages read "Rafie ♡ · 3 new messages" with each line, instead of
 * only the last one.
 */
async function stackMessage(title, body) {
  let previous = null;
  try {
    const open = await self.registration.getNotifications({ tag: MESSAGE_TAG });
    previous = open.length ? open[open.length - 1].data : null;
  } catch {
    // getNotifications is missing on some browsers: show it on its own.
  }
  const count = (typeof previous?.count === "number" ? previous.count : 0) + 1;
  const lines = Array.isArray(previous?.lines) ? previous.lines.slice() : [];
  // With previews off every line is "Sent you a message": show it once.
  if (lines[lines.length - 1] !== body) lines.push(body);
  return {
    title: count > 1 ? `${title} \u00b7 ${count} new messages` : title,
    body: lines.slice(-MAX_LINES).join("\n"),
    count,
    lines: lines.slice(-MAX_LINES),
  };
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Unreadable payload: fall back to a generic notification.
  }
  const kind = typeof data.kind === "string" ? data.kind : "message";
  const sos = kind === "sos";
  const silent = data.silent === true && !sos;
  const title = typeof data.title === "string" ? data.title : "Napyru \u2661";
  const body = typeof data.body === "string" ? data.body : "You have a new message";
  let url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/chat";
  // A message opens the chat with the keyboard ready to answer.
  if (kind === "message") url = "/chat?reply=1";
  const tag = typeof data.tag === "string" ? data.tag : MESSAGE_TAG;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const looking = clients.some((c) => c.focused && c.visibilityState === "visible");
      // Messages, reactions and SOS answers are skipped while you're looking
      // at the app; reminders, alerts and SOS always show.
      if (looking && CAN_SKIP_WHEN_FOCUSED && SKIP_WHEN_FOCUSED.has(kind)) return;
      const stack = kind === "message" && tag === MESSAGE_TAG ? await stackMessage(title, body) : null;
      return self.registration.showNotification(stack ? stack.title : title, {
        body: stack ? stack.body : body,
        tag,
        // Quiet hours: it appears, but doesn't buzz or ring.
        renotify: !silent,
        silent,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        // SOS stays on screen until dismissed and buzzes hard; everything
        // else is a short double tap.
        requireInteraction: sos,
        vibrate: silent ? undefined : sos ? [600, 200, 600, 200, 600, 200, 600] : kind === "love" ? HEARTBEAT : [80, 40, 80],
        timestamp: Date.now(),
        data: { url, kind, count: stack?.count, lines: stack?.lines },
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
