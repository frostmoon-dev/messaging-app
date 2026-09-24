"use client";

import { useServiceWorker } from "@/lib/hooks/useServiceWorker";

/** Registers /sw.js on every page so the app is installable from anywhere. */
export function ServiceWorker() {
  useServiceWorker();
  return null;
}
