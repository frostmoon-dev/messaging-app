import { createClient } from "@/lib/supabase/client";
import { readPref, writePref } from "./prefs";
import { devLog } from "./utils";

// Live location sharing. Web apps can only read location while they are
// open (in the foreground, or briefly in the background on some phones);
// a closed app shares nothing. The UI says so.

export type Position = { lat: number; lng: number; accuracy: number };

export function geolocationSupported() {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function sharingEnabled() {
  return readPref("share-location") === "on";
}

export function setSharingEnabled(on: boolean) {
  writePref("share-location", on ? "on" : null);
  window.dispatchEvent(new Event("napyru:sharing"));
}

/** One fresh position, or an Error with a message fit to show. */
export function currentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!geolocationSupported()) return reject(new Error("Location isn't available on this device."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(locationErrorMessage(e))),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 15_000 },
    );
  });
}

export function locationErrorMessage(e: GeolocationPositionError) {
  if (e.code === e.PERMISSION_DENIED) return "Location is blocked. Allow it for Napyru in your phone's settings.";
  if (e.code === e.TIMEOUT) return "Couldn't get your location in time. Try again outdoors or near a window.";
  return "Couldn't get your location.";
}

/** Metres between two points (haversine). */
export function distanceMetres(a: Pick<Position, "lat" | "lng">, b: Pick<Position, "lat" | "lng">) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Upload when moved this far, or at least this often while standing still.
const MIN_MOVE_METRES = 25;
const MIN_INTERVAL_MS = 20_000;
const HEARTBEAT_MS = 120_000;

/** Decides whether a new reading is worth sending. Pure, so it can be tested. */
export function shouldUpload(last: { at: number; pos: Position } | null, pos: Position, now: number) {
  if (!last) return true;
  const elapsed = now - last.at;
  if (elapsed >= HEARTBEAT_MS) return true;
  if (elapsed < MIN_INTERVAL_MS) return false;
  return distanceMetres(last.pos, pos) >= MIN_MOVE_METRES;
}

export async function uploadPosition(conversationId: string, pos: Position) {
  const { error } = await createClient().rpc("share_location", {
    conv: conversationId,
    lat: pos.lat,
    lng: pos.lng,
    accuracy: Math.round(pos.accuracy),
  });
  if (error) throw error;
}

export async function stopSharing() {
  setSharingEnabled(false);
  const { error } = await createClient().rpc("stop_sharing_location");
  if (error) devLog("stop sharing failed", error);
}

/** Watches position and uploads it while sharing is on. Returns a stop function. */
export function watchAndShare(conversationId: string, onError: (message: string) => void) {
  if (!geolocationSupported()) {
    onError("Location isn't available on this device.");
    return () => {};
  }
  let last: { at: number; pos: Position } | null = null;
  const id = navigator.geolocation.watchPosition(
    (p) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
      const now = Date.now();
      if (!shouldUpload(last, pos, now)) return;
      last = { at: now, pos };
      uploadPosition(conversationId, pos).catch((error) => devLog("location upload failed", error));
    },
    (e) => onError(locationErrorMessage(e)),
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
