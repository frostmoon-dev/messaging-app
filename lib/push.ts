import { createClient } from "@/lib/supabase/client";
import { readPref, writePref } from "./prefs";
import { devLog } from "./utils";

// Web Push: lets the server wake this device when a message arrives, even
// when the app is closed. Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY at build time
// and the send-push Edge Function deployed (see README).
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    Boolean(VAPID_PUBLIC_KEY) &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** This device has a saved push address, so local notifications are not needed. */
export function pushActive() {
  return readPref("push") === "on";
}

export function urlBase64ToUint8Array(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** The service worker registration, or null if none is active within a few seconds. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

function sameKey(current: ArrayBuffer | null | undefined, expected: Uint8Array) {
  if (!current) return false;
  const a = new Uint8Array(current);
  return a.length === expected.length && a.every((byte, i) => byte === expected[i]);
}

/**
 * Subscribes this device (or refreshes an existing subscription) and saves
 * it for the signed-in user. Call only after notification permission is
 * granted. Safe to call on every app start: the server keeps one row per device.
 */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await registration();
  if (!reg) return false;

  const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an old server key can't receive our pushes.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) return false;
  const { error } = await createClient().rpc("save_push_subscription", {
    sub_endpoint: endpoint,
    sub_p256dh: keys.p256dh,
    sub_auth: keys.auth,
  });
  if (error) throw error;
  writePref("push", "on");
  return true;
}

/** Stops pushes to this device: removes the saved address, then unsubscribes. */
export async function disablePush() {
  writePref("push", null);
  if (!pushSupported()) return;
  try {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await createClient().rpc("delete_push_subscription", { sub_endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch (error) {
    devLog("push unsubscribe failed", error);
  }
}
