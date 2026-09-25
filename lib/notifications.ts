import { readPref, writePref } from "./prefs";
import { devLog } from "./utils";
import { pushActive } from "./push";
import { inQuietHours, messagePreview, type QuietHours } from "@/supabase/functions/send-push/push";

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
 * Shows a local notification. The message text shows only when you allow it
 * (Settings → Alerts), so nothing private appears on a lock screen otherwise.
 * During your quiet hours it shows without sound or vibration.
 */
export async function showMessageNotification(
  senderName: string,
  message: { message_type: string; content: string | null },
  settings: { showText: boolean } & QuietHours,
) {
  if (!notificationsEnabled()) return;
  // The server already sends a push to this device; showing both would buzz twice.
  if (pushActive()) return;
  // Same wording as the push version (supabase/functions/send-push/push.ts).
  const title = `${senderName.trim().slice(0, 40) || "Someone"} \u2661`;
  const silent = inQuietHours(settings);
  const options: NotificationOptions = {
    body: messagePreview(message, senderName, settings.showText),
    tag: "new-message",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    silent,
    data: { url: "/chat?reply=1" },
  };
  try {
    // Android Chrome only allows notifications through a service worker.
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, { ...options, renotify: !silent } as NotificationOptions);
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

/** Clears message and reaction pop-ups once you're looking at the chat. */
export async function clearChatNotifications() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const shown = (await registration?.getNotifications()) ?? [];
    for (const n of shown) if (n.tag === "new-message" || n.tag.startsWith("reaction-")) n.close();
  } catch (error) {
    devLog("clearing notifications failed", error);
  }
}
