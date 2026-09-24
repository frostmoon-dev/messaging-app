"use client";

import { usePresence } from "@/components/providers/ChatProvider";
import { Wordmark } from "@/components/ui/Wordmark";
import { DayClock } from "@/components/ui/DayClock";
import { cn } from "@/lib/utils";

export function DesktopHeader() {
  const { connection } = usePresence();
  const text =
    connection === "online" ? null : connection === "offline" ? "Offline" : connection === "reconnecting" ? "Reconnecting…" : "Connecting…";
  return (
    <header className="relative hidden h-16 shrink-0 items-center gap-8 border-b border-border bg-background px-6 lg:flex">
      <Wordmark />
      <p className="text-display mr-auto flex items-center gap-2 text-[11px] tracking-[0.25em] text-muted" role="status">
        <span className={cn("size-2 -skew-x-12", live ? "bg-accent-strong" : "animate-pulse bg-muted")} aria-hidden="true" />
        {live ? "Private line · live" : "Connecting…"}
      </p>
      <DayClock />
      <span className="absolute bottom-0 left-0 h-[3px] w-40 -skew-x-[30deg] bg-accent" aria-hidden="true" />
    </header>
  );
}
