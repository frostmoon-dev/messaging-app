"use client";

import { usePresence } from "@/components/providers/ChatProvider";
import { Wordmark } from "@/components/ui/Wordmark";

export function DesktopHeader() {
  const { connection } = usePresence();
  const text =
    connection === "online" ? null : connection === "offline" ? "Offline" : connection === "reconnecting" ? "Reconnecting…" : "Connecting…";
  return (
    <header className="hidden h-14 shrink-0 items-center justify-between border-b border-border bg-background-raised px-5 lg:flex">
      <Wordmark />
      {/* Only speak up when something is wrong. A healthy connection needs no label. */}
      <p className="text-small text-muted" role="status">
        {text}
      </p>
    </header>
  );
}
