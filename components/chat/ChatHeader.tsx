"use client";

import { useState } from "react";
import { useChat, usePresence } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPicker } from "@/components/profile/StatusPicker";
import { StatusIcon } from "@/components/ui/StatusIcon";
import { activeStatus } from "@/lib/status";
import { formatLastSeen } from "@/lib/time";
import { cn } from "@/lib/utils";

export function ChatHeader() {
  const { partner, me } = useChat();
  const { partnerOnline, partnerTyping, partnerLastSeen } = usePresence();
  const [pickerOpen, setPickerOpen] = useState(false);
  const status = activeStatus(partner);
  const myStatus = activeStatus(me);

  // One line of presence. Typing wins, then online, then last seen.
  const presence = partnerTyping ? "Typing…" : partnerOnline ? "Online" : formatLastSeen(partnerLastSeen);

  return (
    <header className="relative z-10 shrink-0 border-b-2 border-accent bg-background-raised pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
        <Avatar profile={partner} size="md" online={partnerOnline} />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-title font-bold">{partner.display_name}</h1>
          <p className="flex min-w-0 items-center gap-2 text-small" aria-live="polite">
            <span
              className={cn(
                "shrink-0",
                partnerTyping ? "text-accent-text" : partnerOnline ? "text-online" : "text-muted",
              )}
            >
              {presence}
            </span>
            {status && (
              <span className="flex min-w-0 items-center gap-1.5 text-muted-strong">
                <span aria-hidden="true">·</span>
                {status.icon && <StatusIcon icon={status.icon} className="size-4" />}
                <span className="truncate">{status.text}</span>
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="p5-button flex min-h-11 items-center gap-2 bg-panel-strong px-4 text-small font-semibold text-foreground transition-colors hover:bg-border"
          aria-label={myStatus ? `Your status: ${myStatus.text}. Change status` : "Set your status"}
        >
          {myStatus?.icon && <StatusIcon icon={myStatus.icon} />}
          <span className={cn(myStatus?.icon && "hidden sm:inline")}>{myStatus ? "My status" : "Set status"}</span>
        </button>
      </div>

      {pickerOpen && <StatusPicker onClose={() => setPickerOpen(false)} />}
    </header>
  );
}
