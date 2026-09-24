"use client";

import { useState } from "react";
import { useChat, usePresence } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPicker } from "@/components/profile/StatusPicker";
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
    <header className="relative z-10 shrink-0 border-b border-border bg-background-raised pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
        <Avatar profile={partner} size="md" online={partnerOnline} />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-title font-bold">{partner.display_name}</h1>
          <p className="flex min-w-0 items-center gap-2 text-small" aria-live="polite">
            <span
              className={cn(
                "shrink-0",
                partnerTyping ? "text-accent-strong" : partnerOnline ? "text-online" : "text-muted",
              )}
            >
              {presence}
            </span>
            {status && (
              <span className="truncate text-muted-strong">
                <span aria-hidden="true">· {status.emoji}</span> {status.text}
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex min-h-11 items-center gap-2 rounded-full border border-field-border px-3 text-small text-muted-strong transition-colors hover:bg-panel-strong hover:text-foreground"
          aria-label={myStatus ? `Your status: ${myStatus.emoji} ${myStatus.text}. Change status` : "Set your status"}
        >
          {myStatus?.emoji && <span className="text-body leading-none" aria-hidden="true">{myStatus.emoji}</span>}
          <span className={cn(myStatus?.emoji && "hidden sm:inline")}>{myStatus ? "My status" : "Set status"}</span>
        </button>
      </div>

      {pickerOpen && <StatusPicker onClose={() => setPickerOpen(false)} />}
    </header>
  );
}
