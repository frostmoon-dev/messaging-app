"use client";

import { useSyncExternalStore } from "react";
import { getChatBackground, getServerChatBackground, subscribeChatBackground, type ChatBackground } from "@/lib/chat-background";

export function useChatBackground() {
  return useSyncExternalStore(subscribeChatBackground, getChatBackground, getServerChatBackground);
}

/** The layer behind the messages. A photo is covered by the theme background at `dim`. */
export function ChatBackdrop({ background, className = "absolute inset-0" }: { background: ChatBackground; className?: string }) {
  if (background.kind === "none") return null;
  if (background.kind === "pattern") {
    return <div className={`${className} chat-pattern chat-pattern-${background.pattern}`} aria-hidden="true" />;
  }
  return (
    <div className={`${className} overflow-hidden`} aria-hidden="true">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${background.src}")` }} />
      <div className="absolute inset-0 bg-background" style={{ opacity: background.dim }} />
    </div>
  );
}
