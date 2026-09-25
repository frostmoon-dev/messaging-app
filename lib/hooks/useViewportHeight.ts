"use client";

import { useEffect } from "react";

/**
 * Keeps --app-height equal to the visual viewport height. On iOS Safari the
 * layout viewport does not shrink when the keyboard opens, so without this the
 * composer would sit behind the keyboard. Also sets data-keyboard="open" on
 * <html> so the bottom navigation can get out of the way.
 */
function isTyping() {
  const el = document.activeElement;
  return (
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "range", "file"].includes(el.type)) ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

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
        // The keyboard is open only if the view shrank *and* you're typing
        // somewhere. The size alone can be stale (opening from a pop-up or
        // coming back from the background), which hid the tab bar for good.
        const keyboardOpen = window.innerHeight - height > 140 && isTyping();
        root.dataset.keyboard = keyboardOpen ? "open" : "closed";
        // iOS scrolls the page when focusing inputs; pin it back.
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      });
    };

    // Re-check whenever typing starts or stops, and when the app comes back.
    const later = () => setTimeout(update, 250);
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", later);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", later);
    };
  }, []);
}
