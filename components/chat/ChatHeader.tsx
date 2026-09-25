"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useChat, usePresence } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPicker } from "@/components/profile/StatusPicker";
import { StatusIcon } from "@/components/ui/StatusIcon";
import { activeStatus } from "@/lib/status";
import { formatLastSeen } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ConnectionBanner } from "./ConnectionBanner";
import { PinnedBar } from "./PinnedBar";
import { HeartIcon, StarIcon } from "@/components/ui/icons";
import { sendAlert } from "@/lib/alerts";
import { haptic } from "@/lib/haptics";
import { devLog } from "@/lib/utils";
import { FavouritesSheet } from "@/components/settings/FavouritesSheet";

/**
 * Frosted glass over the top of the chat: messages (and a photo background)
 * scroll softly underneath. It floats, so it publishes its height as
 * --chat-header-h on the chat for the list's top padding.
 */
export function ChatHeader({ onJump }: { onJump: (id: string) => void }) {
  const { partner, me, conversationId } = useChat();
  const { partnerOnline, partnerTyping, partnerLastSeen } = usePresence();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [favouritesOpen, setFavouritesOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const status = activeStatus(partner);
  const myStatus = activeStatus(me);
  // "Thinking of you": the heart fills for a moment, then resets.
  const [love, setLove] = useState<"idle" | "sent" | "failed">("idle");
  const loveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (loveTimer.current) clearTimeout(loveTimer.current);
  }, []);

  const sendLove = async () => {
    haptic("heart");
    setLove("sent");
    if (loveTimer.current) clearTimeout(loveTimer.current);
    loveTimer.current = setTimeout(() => setLove("idle"), 2500);
    try {
      await sendAlert(conversationId, "love");
    } catch (error) {
      // Usually the flood guard (3 a minute).
      devLog("thinking of you failed", error);
      setLove("failed");
    }
  };

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
        // Rounded underneath and lifted off the chat: a floating sheet of glass.
        "absolute inset-x-0 top-0 z-20 rounded-b-[24px] pt-[env(safe-area-inset-top)]",
        "bg-[color-mix(in_srgb,var(--background-raised)_78%,transparent)] backdrop-blur-xl backdrop-saturate-150",
        "shadow-[0_1px_0_color-mix(in_srgb,var(--foreground)_8%,transparent),var(--shadow-float)]",
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
                partnerTyping ? "text-love" : partnerOnline ? "text-online" : "text-muted",
              )}
            >
              {presence}
            </span>
            {status && (
              <>
                <span className="text-muted" aria-hidden="true">
                  ·
                </span>
                {/* Text only here: at this size the status artwork turns into a blot. */}
                <span className="min-w-0 truncate text-muted-strong">{status.text}</span>
              </>
            )}
          </p>
        </div>

        {/* "Thinking of you": one tap, a heartbeat on their phone. */}
        <div className="relative shrink-0">
          <motion.button
            type="button"
            onClick={() => void sendLove()}
            whileTap={{ scale: 0.85 }}
            className={cn(
              "flex size-11 items-center justify-center rounded-full transition-colors hover:bg-panel-strong/60",
              love === "sent" ? "text-love" : "text-foreground",
            )}
            aria-label={`Send ${partner.display_name} a “thinking of you”`}
          >
            <motion.span
              key={love}
              initial={love === "sent" ? { scale: 0.6 } : false}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 14 }}
              className="flex"
            >
              <HeartIcon size={22} fill={love === "sent" ? "currentColor" : "none"} />
            </motion.span>
          </motion.button>
          <AnimatePresence>
            {love !== "idle" && (
              <motion.span
                key={love}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "pointer-events-none absolute top-full left-1/2 z-30 mt-1 -translate-x-1/2 rounded-full bg-panel-strong px-2.5 py-1 text-meta font-semibold whitespace-nowrap shadow-[var(--shadow-raised)]",
                  love === "failed" ? "text-danger" : "text-love",
                )}
                aria-hidden="true"
              >
                {love === "failed" ? "Try again in a minute" : "Sent ♡"}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="sr-only" aria-live="polite">
            {love === "sent" ? `Sent. ${partner.display_name} will feel a heartbeat.` : love === "failed" ? "Couldn't send. Try again in a minute." : ""}
          </span>
        </div>

        {/* Your favourites (only you see them). */}
        <button
          type="button"
          onClick={() => setFavouritesOpen(true)}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-panel-strong/60"
          aria-label="Favourites"
          aria-haspopup="dialog"
        >
          <StarIcon size={22} />
        </button>

        {/* Your own status: just its icon (still a 44px target), or "Set status". */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={cn(
            "-mr-2 flex shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-panel-strong/60",
            myStatus?.icon ? "size-11" : "min-h-11 px-3 text-small font-semibold",
          )}
          aria-label={myStatus ? `Your status: ${myStatus.text}. Change status` : "Set your status"}
        >
          {myStatus?.icon ? <StatusIcon icon={myStatus.icon} className="size-7" /> : myStatus ? "My status" : "Set status"}
        </button>
      </div>

      <PinnedBar onJump={onJump} />
      <ConnectionBanner />
      {pickerOpen && <StatusPicker onClose={() => setPickerOpen(false)} />}
      {favouritesOpen && <FavouritesSheet onClose={() => setFavouritesOpen(false)} onPick={onJump} />}
    </header>
  );
}
