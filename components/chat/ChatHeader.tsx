"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat, usePresence } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPicker } from "@/components/profile/StatusPicker";
import { StatusIcon } from "@/components/ui/StatusIcon";
import { activeStatus } from "@/lib/status";
import { formatLastSeen } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ConnectionBanner } from "./ConnectionBanner";

/**
 * Frosted glass over the top of the chat: messages (and a photo background)
 * scroll softly underneath. It floats, so it publishes its height as
 * --chat-header-h on the chat for the list's top padding.
 */
export function ChatHeader() {
  const { partner, me } = useChat();
  const { partnerOnline, partnerTyping, partnerLastSeen } = usePresence();
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const status = activeStatus(partner);
  const myStatus = activeStatus(me);

  useEffect(() => {
    const header = ref.current;
    const chat = header?.parentElement;
    if (!header || !chat) return;
    const publish = () => chat.style.setProperty("--chat-header-h", `${header.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // One line of presence. Typing wins, then online, then last seen.
  const presence = partnerTyping ? "typing…" : partnerOnline ? "Online" : formatLastSeen(partnerLastSeen);

  return (
    <header
      ref={ref}
      className={cn(
        "absolute inset-x-0 top-0 z-20 pt-[env(safe-area-inset-top)]",
        "bg-[color-mix(in_srgb,var(--background-raised)_78%,transparent)] backdrop-blur-xl backdrop-saturate-150",
        "shadow-[0_1px_0_color-mix(in_srgb,var(--foreground)_8%,transparent)]",
      )}
    >
      <div className="flex min-h-[4.5rem] items-center gap-3 px-4">
        <Link href="/bond" className="shrink-0 rounded-full" aria-label={`Bond with ${partner.display_name}`}>
          <Avatar profile={partner} size="md" online={partnerOnline} className="size-12" />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate script-name text-[1.625rem] leading-tight">{partner.display_name}</h1>
          <p className="flex min-w-0 items-center gap-1.5 text-meta" aria-live="polite">
            <span
              className={cn(
                "shrink-0 font-semibold",
                partnerTyping ? "text-foreground" : partnerOnline ? "text-online" : "text-muted",
              )}
            >
              {presence}
            </span>
            {status && (
              <>
                <span className="text-muted" aria-hidden="true">
                  ·
                </span>
                <span className="flex min-w-0 items-center gap-1 text-muted-strong">
                  {status.icon && <StatusIcon icon={status.icon} className="size-3.5" />}
                  <span className="truncate">{status.text}</span>
                </span>
              </>
            )}
          </p>
        </div>

        {/* Your own status: a round button with its icon, or a small "Set status" pill. */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-panel-strong/80 text-foreground transition-colors hover:bg-panel-strong",
            myStatus?.icon ? "size-11" : "min-h-11 px-4 text-small font-semibold",
          )}
          aria-label={myStatus ? `Your status: ${myStatus.text}. Change status` : "Set your status"}
        >
          {myStatus?.icon ? <StatusIcon icon={myStatus.icon} /> : myStatus ? "My status" : "Set status"}
        </button>
      </div>

      <ConnectionBanner />
      {pickerOpen && <StatusPicker onClose={() => setPickerOpen(false)} />}
    </header>
  );
}
