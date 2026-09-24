"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useChat } from "@/components/providers/ChatProvider";
import { sharingEnabled, watchAndShare } from "@/lib/location";
import { devLog } from "@/lib/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("napyru:sharing", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("napyru:sharing", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** While "Share my live location" is on, keeps uploading it on every screen. */
export function LocationSharer() {
  const { conversationId } = useChat();
  const on = useSyncExternalStore(subscribe, sharingEnabled, () => false);

  useEffect(() => {
    if (!on) return;
    return watchAndShare(conversationId, (message) => devLog("location", message));
  }, [on, conversationId]);

  return null;
}
