"use client";

import { usePresence } from "@/components/providers/ChatProvider";
import { Wordmark } from "@/components/ui/Wordmark";
import { DayClock } from "@/components/ui/DayClock";

export function DesktopHeader() {
  const { connection } = usePresence();
  const text =
    connection === "online"
      ? null
      : connection === "offline"
        ? "Offline"
        : connection === "reconnecting"
          ? "Reconnecting…"
          : "Connecting…";

  return (
    <header className="hidden h-16 shrink-0 items-center gap-6 border-b border-border bg-background-raised px-4 lg:flex">
      <Wordmark />
      <p className="mr-auto text-small text-muted-strong" role="status">
        {text}
      </p>
      <DayClock />
    </header>
  );
}
