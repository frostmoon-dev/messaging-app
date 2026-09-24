import { createClient } from "@/lib/supabase/client";
import { devLog } from "@/lib/utils";
import type { Bucket } from "./upload";

// Buckets are private. Images are shown through short-lived signed URLs that
// are cached in memory (never persisted) and requested in small batches.
const TTL_SECONDS = 60 * 60;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();
const pending = new Map<Bucket, Map<string, Array<(url: string | null) => void>>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const keyOf = (bucket: Bucket, path: string) => `${bucket}/${path}`;

export function getCachedSignedUrl(bucket: Bucket, path: string) {
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
}

export function clearSignedUrlCache() {
  cache.clear();
}
