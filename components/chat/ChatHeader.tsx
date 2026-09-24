"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat, usePresence } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { SettingsIcon } from "@/components/ui/icons";
import { StatusPicker } from "@/components/profile/StatusPicker";
import { activeStatus } from "@/lib/status";
import { formatLastSeen } from "@/lib/time";

export function ChatHeader() {
  const { partner, me } = useChat();
  const { partnerOnline, partnerTyping, partnerLastSeen } = usePresence();
  const [pickerOpen, setPickerOpen] = useState(false);
  const status = activeStatus(partner);
  const myStatus = activeStatus(me);

  return (
    <header className="relative z-10 shrink-0 border-b border-border bg-background-raised pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
        <Avatar profile={partner} size="md" online={partnerOnline} />

        <div className="min-w-0 flex-1">
          <h1 className="text-display truncate text-[26px] leading-none">{partner.display_name}</h1>
          <div className="mt-1 flex min-h-5 items-center gap-2 text-[11px]" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {partnerTyping ? (
                <motion.span
                  key="typing"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-display tracking-[0.2em] text-accent-strong"
                >
                  Typing…
                </motion.span>
              ) : partnerOnline ? (
                <motion.span
                  key="online"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="shape-tag text-display bg-foreground px-2 py-0.5 tracking-[0.2em] text-background"
                >
                  Online
                </motion.span>
              ) : (
                <motion.span
                  key="offline"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-display tracking-[0.2em] text-muted"
                >
                  {formatLastSeen(partnerLastSeen)}
                </motion.span>
              )}
            </AnimatePresence>
            {status && (
              <span className="truncate text-muted-strong" title="Status">
                <span aria-hidden="true">{status.emoji}</span> {status.text}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="shape-tag flex min-h-10 items-center gap-1.5 bg-panel-strong px-3 text-xs hover:bg-border"
          aria-label={myStatus ? `Your status: ${myStatus.emoji} ${myStatus.text}. Change status` : "Set your status"}
        >
          <span className="text-base leading-none" aria-hidden="true">{myStatus?.emoji || "＋"}</span>
          <span className="text-display hidden tracking-wider sm:inline">{myStatus ? "Status" : "Set status"}</span>
        </button>
        <Link
          href="/settings"
          className="flex size-11 items-center justify-center text-foreground hover:text-accent-strong lg:hidden"
          aria-label="Settings"
        >
          <SettingsIcon />
        </Link>
      </div>

      <span className="absolute -bottom-px left-0 h-[2px] w-24 -skew-x-[30deg] bg-accent" aria-hidden="true" />

      {pickerOpen && <StatusPicker onClose={() => setPickerOpen(false)} />}
    </header>
  );
}
