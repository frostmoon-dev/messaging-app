import { readPref, writePref } from "./prefs";
import { devLog } from "./utils";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export function notificationsEnabled() {
  return notificationPermission() === "granted" && readPref("notify") !== "off";
}

export function setNotificationsMuted(muted: boolean) {
  writePref("notify", muted ? "off" : null);
}

export function promptDismissed() {
  return readPref("notify-prompt") === "dismissed";
}

export function dismissPrompt() {
  writePref("notify-prompt", "dismissed");
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported" as const;
  try {
    const result = await Notification.requestPermission();
    if (result === "granted") setNotificationsMuted(false);
    return result;
  } catch (error) {
    devLog("notification permission failed", error);
    return "denied" as const;
  }
}

/**
 * Shows a local notification. Content of the message is deliberately left out
 * so nothing private appears on a lock screen.
 */
export async function showMessageNotification(senderName: string) {
  if (!notificationsEnabled()) return;
  const title = "NEW MESSAGE";
  const options: NotificationOptions = {
    body: `${senderName} sent you a message`,
    tag: "new-message",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    data: { url: "/chat" },
  };
  try {
    // Android Chrome only allows notifications through a service worker.
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, { ...options, renotify: true } as NotificationOptions);
      return;
    }
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (error) {
    devLog("notification failed", error);
  }
}
