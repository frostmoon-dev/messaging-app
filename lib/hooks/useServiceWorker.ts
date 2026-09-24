"use client";

import { useEffect } from "react";
import { devLog } from "@/lib/utils";

/** Registers the service worker (installable PWA + notification clicks). */
export function useServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_SW_DEV !== "true") return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => devLog("service worker registration failed", error));
  }, []);
}
