"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageActions } from "./MessageActions";
import { ChatBackdrop, useChatBackground } from "./ChatBackdrop";
import { TypingIndicator } from "./TypingIndicator";
import { MessageComposer } from "./MessageComposer";
import { NotificationPrompt } from "./NotificationPrompt";
import { ImageViewer } from "@/components/ui/ImageViewer";
import { notificationPermission, promptDismissed } from "@/lib/notifications";

export function ChatWindow() {
  const { setChatActive, ensureLoaded, messages } = useChat();
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  // Looked up live, so the sheet closes itself if the message goes away.
  const actionsMessage = actionsFor ? messages.find((m) => m.id === actionsFor && !m.deleted_at) : undefined;
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

  // /chat?m=<id> (from Favourites) opens the chat at that message.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("m");
    if (!id) return;
    window.history.replaceState(null, "", "/chat");
    // Give the first page of messages a moment to arrive before jumping.
    const t = setTimeout(() => void jumpTo(id), 400);
    return () => clearTimeout(t);
  }, [jumpTo]);

  const onSent = useCallback(() => {
    if (notificationPermission() === "default" && !promptDismissed()) setAskNotify(true);
  }, []);

  const background = useChatBackground();

  return (
    <section className="relative flex h-full min-h-0 flex-col" aria-label="Chat">
      <ChatHeader onJump={(id) => void jumpTo(id)} />
      {/* Messages and the typing row share the chat background. */}
      <div className="relative flex min-h-0 flex-1 flex-col" data-chat-background={background.kind}>
        <ChatBackdrop background={background} />
        <MessageList
          highlightedId={highlighted}
          onReply={setReplyTo}
          onJump={jumpTo}
          onOpenImage={(src, alt) => setViewer({ src, alt })}
          onActions={setActionsFor}
        />
        <AnimatePresence>
          {jumpError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative mx-auto mb-1 rounded-full bg-panel-strong px-3 py-1 text-small"
              role="status"
            >
              {jumpError}
            </motion.p>
          )}
        </AnimatePresence>
        <TypingIndicator />
      </div>
      <NotificationPrompt open={askNotify} onDone={() => setAskNotify(false)} />
      <MessageComposer replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onSent={onSent} />
      {actionsMessage && (
        <MessageActions message={actionsMessage} onReply={setReplyTo} onClose={() => setActionsFor(null)} />
      )}
      {viewer && <ImageViewer src={viewer.src} alt={viewer.alt} onClose={() => setViewer(null)} />}
    </section>
  );
}
