import { createClient } from "@/lib/supabase/client";
import { devLog } from "@/lib/utils";
import type { Bucket } from "./upload";

// Buckets are private. Images are shown through short-lived signed URLs that
// are requested in small batches. They're also kept on this device until they
// expire: the same link on the next launch lets the browser show the photo
// from its own cache instead of downloading it again. Wiped on sign-out.
const TTL_SECONDS = 60 * 60 * 6;
const REFRESH_MARGIN_MS = 10 * 60 * 1000;
const STORE_KEY = "napyru:signed-urls:v1";

type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();
let restored = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function restore() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}") as Record<string, Entry>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(saved)) {
      if (entry?.url && entry.expiresAt - REFRESH_MARGIN_MS > now) cache.set(key, entry);
    }
  } catch {
    // Nothing saved, or storage unavailable.
  }
}

function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const now = Date.now();
      const fresh = [...cache.entries()].filter(([, e]) => e.expiresAt - REFRESH_MARGIN_MS > now).slice(-400);
      window.localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(fresh)));
    } catch {
      // Full or unavailable storage: links just aren't reused next time.
    }
  }, 500);
}
const pending = new Map<Bucket, Map<string, Array<(url: string | null) => void>>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const keyOf = (bucket: Bucket, path: string) => `${bucket}/${path}`;

export function getCachedSignedUrl(bucket: Bucket, path: string) {
  restore();
  const hit = cache.get(keyOf(bucket, path));
  return hit && hit.expiresAt - REFRESH_MARGIN_MS > Date.now() ? hit.url : null;
}

async function flush() {
  flushTimer = null;
  const batches = [...pending.entries()];
  pending.clear();
  const supabase = createClient();

  await Promise.all(
    batches.map(async ([bucket, requests]) => {
      const paths = [...requests.keys()];
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, TTL_SECONDS);
      if (error) devLog("signed url batch failed", error);
      const byPath = new Map<string, string>();
      for (const item of data ?? []) {
        if (item.path && item.signedUrl && !item.error) byPath.set(item.path, item.signedUrl);
      }
      for (const [path, callbacks] of requests) {
        const url = byPath.get(path) ?? null;
        if (url) cache.set(keyOf(bucket, path), { url, expiresAt: Date.now() + TTL_SECONDS * 1000 });
        callbacks.forEach((cb) => cb(url));
      }
      save();
    }),
  );
}

export function getSignedUrl(bucket: Bucket, path: string): Promise<string | null> {
  const cached = getCachedSignedUrl(bucket, path);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const forBucket = pending.get(bucket) ?? new Map<string, Array<(url: string | null) => void>>();
    pending.set(bucket, forBucket);
    forBucket.set(path, [...(forBucket.get(path) ?? []), resolve]);
    if (!flushTimer) flushTimer = setTimeout(flush, 16);
  });
}

export function invalidateSignedUrl(bucket: Bucket, path: string) {
  cache.delete(keyOf(bucket, path));
  save();
}

export function clearSignedUrlCache() {
  cache.clear();
  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch {
    // Nothing to clear.
  }
}
