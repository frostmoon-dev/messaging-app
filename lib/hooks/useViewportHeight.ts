"use client";

import { useEffect } from "react";

/**
 * Keeps --app-height equal to the visual viewport height. On iOS Safari the
 * layout viewport does not shrink when the keyboard opens, so without this the
 * composer would sit behind the keyboard. Also sets data-keyboard="open" on
 * <html> so the bottom navigation can get out of the way.
 */
export function useViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = vv?.height ?? window.innerHeight;
        root.style.setProperty("--app-height", `${Math.round(height)}px`);
        const keyboardOpen = window.innerHeight - height > 140;
        root.dataset.keyboard = keyboardOpen ? "open" : "closed";
        // iOS scrolls the page when focusing inputs; pin it back.
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      });
    };

    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
}
