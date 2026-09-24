"use client";

import { usePresence } from "@/components/providers/ChatProvider";
import { Wordmark } from "@/components/ui/Wordmark";
import { cn } from "@/lib/utils";

export function DesktopHeader() {
  const { connection } = usePresence();
  const live = connection === "online";
  return (
    <header className="relative hidden h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6 lg:flex">
      <Wordmark />
      <p className="text-display flex items-center gap-2 text-[11px] tracking-[0.25em] text-muted" role="status">
        <span className={cn("size-2 -skew-x-12", live ? "bg-accent-strong" : "animate-pulse bg-muted")} aria-hidden="true" />
        {live ? "Private line · live" : "Connecting…"}
      </p>
      <span className="absolute bottom-0 left-0 h-[3px] w-40 -skew-x-[30deg] bg-accent" aria-hidden="true" />
    </header>
  );
}
