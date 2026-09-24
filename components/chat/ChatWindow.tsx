"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { ChatHeader } from "./ChatHeader";
import { ConnectionBanner } from "./ConnectionBanner";
import { MessageList } from "./MessageList";
import { TypingIndicator } from "./TypingIndicator";
import { MessageComposer } from "./MessageComposer";
import { NotificationPrompt } from "./NotificationPrompt";
import { ImageViewer } from "@/components/ui/ImageViewer";
import { notificationPermission, promptDismissed } from "@/lib/notifications";

export function ChatWindow() {
  const { setChatActive, ensureLoaded } = useChat();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ src: string; alt: string } | null>(null);
  const [askNotify, setAskNotify] = useState(false);
  const [jumpError, setJumpError] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tell the provider the chat is on screen, so incoming messages count as read.
  useEffect(() => {
    setChatActive(true);
    return () => setChatActive(false);
  }, [setChatActive]);

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

  const jumpTo = useCallback(
    async (id: string) => {
      const ok = await ensureLoaded(id);
      if (!ok) {
        setJumpError("That message isn't available anymore.");
        setTimeout(() => setJumpError(null), 2500);
        return;
      }
      // Wait a frame for newly loaded history to render.
      requestAnimationFrame(() => {
        const el = document.getElementById(`msg-${id}`);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        setHighlighted(null);
        requestAnimationFrame(() => setHighlighted(id));
        if (highlightTimer.current) clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => setHighlighted(null), 1600);
      });
    },
    [ensureLoaded],
  );

  const onSent = useCallback(() => {
    if (notificationPermission() === "default" && !promptDismissed()) setAskNotify(true);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0.9, 0.1, 1] }}
      className="relative flex h-full min-h-0 flex-col"
      aria-label="Chat"
    >
      <ChatHeader />
      <ConnectionBanner />
      <MessageList
        highlightedId={highlighted}
        onReply={setReplyTo}
        onJump={jumpTo}
        onOpenImage={(src, alt) => setViewer({ src, alt })}
      />
      <AnimatePresence>
        {jumpError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto mb-1 bg-panel-strong px-3 py-1 text-xs text-muted-strong"
            role="status"
          >
            {jumpError}
          </motion.p>
        )}
      </AnimatePresence>
      <TypingIndicator />
      <NotificationPrompt open={askNotify} onDone={() => setAskNotify(false)} />
      <MessageComposer replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onSent={onSent} />
      {viewer && <ImageViewer src={viewer.src} alt={viewer.alt} onClose={() => setViewer(null)} />}
    </motion.section>
  );
}
