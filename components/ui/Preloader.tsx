"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Start-up screen: the app icon on paper white with "Loading" below. It's
 * part of the first HTML, so it shows before any JavaScript runs, then
 * fades out once the app is ready. Client-side navigation keeps the root
 * layout, so it never shows again until the next full load. If scripts
 * fail, CSS hides it after 10 s (see .preloader in globals.css).
 */
export function Preloader() {
  const [phase, setPhase] = useState<"shown" | "leaving" | "gone">("shown");

  useEffect(() => {
    const leave = setTimeout(() => setPhase("leaving"), 300);
    const gone = setTimeout(() => setPhase("gone"), 650);
    return () => {
      clearTimeout(leave);
      clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={cn("preloader", phase === "leaving" && "preloader-leave")} role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element -- must render before any JS; plain img */}
      <img src="/icons/icon-192.png" alt="" width={96} height={96} className="preloader-icon" />
      <p className="preloader-text">Loading</p>
      <span className="preloader-bar" aria-hidden="true">
        <span />
      </span>
    </div>
  );
}
