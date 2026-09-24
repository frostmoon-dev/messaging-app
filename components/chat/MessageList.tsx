"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { MessageBubble } from "./MessageBubble";
import { EmptyChat } from "./EmptyChat";
import { ArrowDownIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { formatDayLabel, isSameDay, minutesApart } from "@/lib/time";
import { useIsTouch } from "@/lib/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const GROUP_GAP_MINUTES = 5;
const BOTTOM_THRESHOLD = 96;

export function MessageList({
  highlightedId,
  onReply,
  onJump,
  onOpenImage,
}: {
  highlightedId: string | null;
  onReply: (id: string) => void;
  onJump: (id: string) => void;
  onOpenImage: (src: string, alt: string) => void;
}) {
  const {
    me,
    partner,
    messages,
    loaded,
    loadError,
    hasMore,
    loadingOlder,
    loadOlder,
    reload,
    retry,
    discard,
    getSnippet,
    localPreview,
  } = useChat();
  const isTouch = useIsTouch();

  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  // Only messages newer than what was on screen at first load get an entrance.
  const [baseline, setBaseline] = useState<string | null>(null);
  const lastIdRef = useRef<string | null>(null);

  if (loaded && baseline === null) {
    const newest = messages.filter((m) => !m.local).at(-1);
    setBaseline(newest?.created_at ?? "");
  }

  // The scroller is `flex-col-reverse`, so scrollTop 0 is the bottom and the
  // browser keeps the view anchored to the newest message on its own.
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: 0, behavior: smooth && !reduce ? "smooth" : "auto" });
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = Math.abs(el.scrollTop) < BOTTOM_THRESHOLD;
    setAtBottom(bottom);
    if (bottom) setUnseen(0);
  };

  // React to a new last message: follow my own sends, count partner ones
  // that arrive while scrolled up.
  useLayoutEffect(() => {
    const last = messages.at(-1);
    if (!last || last.id === lastIdRef.current) return;
    const isFirst = lastIdRef.current === null;
    lastIdRef.current = last.id;
    if (isFirst) return;
    if (last.sender_id === me.id) {
      scrollToBottom();
    } else if (!atBottom) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from a new message arriving
      setUnseen((n) => n + 1);
    }
  }, [messages, me.id, atBottom, scrollToBottom]);

  // Load older messages when the top sentinel scrolls into view.
  useEffect(() => {
    const target = topRef.current;
    const root = scrollRef.current;
    if (!target || !root || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadOlder();
      },
      { root, rootMargin: "400px 0px 0px 0px" },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [hasMore, loadOlder, loaded]);

  if (!loaded && loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
        <p className="text-display text-2xl">Signal lost</p>
        <p className="text-sm text-muted-strong">{loadError}</p>
        <Button onClick={() => void reload()}>Try again</Button>
      </div>
    );
  }

  if (!loaded) return <ChatSkeleton />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scroll-area flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain"
        role="log"
        aria-label={`Conversation with ${partner.display_name}`}
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
      >
        <div className="flex flex-col pt-4 pb-2">
          <div ref={topRef} aria-hidden="true" />
          {hasMore && (
            <div className="flex justify-center py-3">
              {loadingOlder ? (
                <span className="text-display text-[11px] tracking-[0.25em] text-muted">Loading history…</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadOlder()}
                  className="text-display min-h-9 px-3 text-[11px] tracking-[0.25em] text-muted hover:text-foreground"
                >
                  Load earlier
                </button>
              )}
            </div>
          )}

          {messages.length === 0 && <EmptyChat />}

          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || !isSameDay(prev.created_at, m.created_at);
            const firstInGroup =
              newDay || prev.sender_id !== m.sender_id || minutesApart(prev.created_at, m.created_at) > GROUP_GAP_MINUTES;
            const lastInGroup =
              !next ||
              next.sender_id !== m.sender_id ||
              !isSameDay(next.created_at, m.created_at) ||
              minutesApart(next.created_at, m.created_at) > GROUP_GAP_MINUTES;
            const mine = m.sender_id === me.id;
            const snippet = m.reply_to ? getSnippet(m.reply_to) : undefined;

            return (
              <Fragment key={m.id}>
                {newDay && <DayDivider iso={m.created_at} />}
                <MessageBubble
                  message={m}
                  mine={mine}
                  firstInGroup={firstInGroup}
                  lastInGroup={lastInGroup}
                  animateIn={Boolean(m.local) || (baseline !== null && m.created_at > baseline)}
                  highlighted={highlightedId === m.id}
                  swipeEnabled={isTouch}
                  author={mine ? me : partner}
                  replySnippet={snippet}
                  replyAuthorName={snippet ? (snippet.sender_id === me.id ? "You" : partner.display_name) : ""}
                  localPreview={m.message_type === "image" ? localPreview(m.id) : undefined}
                  onReply={onReply}
                  onJump={onJump}
                  onRetry={retry}
                  onDiscard={discard}
                  onOpenImage={onOpenImage}
                />
              </Fragment>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {!atBottom && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.16 }}
            onClick={() => scrollToBottom()}
            className={cn(
              "shape-tag text-display absolute right-4 bottom-3 flex min-h-10 items-center gap-2 px-4 text-xs tracking-widest",
              unseen ? "bg-accent text-accent-foreground" : "bg-panel-strong text-foreground",
            )}
            aria-label={unseen ? `${unseen} new messages. Scroll to latest.` : "Scroll to latest message"}
          >
            {unseen > 0 && <span>{unseen} new</span>}
            <ArrowDownIcon size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function DayDivider({ iso }: { iso: string }) {
  return (
    <div className="my-4 flex items-center gap-3 px-6" role="separator" aria-label={formatDayLabel(iso)}>
      <span className="h-px flex-1 bg-border" />
      <span className="shape-tag text-display bg-panel-strong px-3 py-1 text-[11px] tracking-[0.25em] text-muted-strong">
        {formatDayLabel(iso)}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function ChatSkeleton() {
  const rows = [
    { mine: false, w: "w-48" },
    { mine: false, w: "w-64" },
    { mine: true, w: "w-40" },
    { mine: false, w: "w-56" },
    { mine: true, w: "w-72" },
    { mine: true, w: "w-32" },
  ];
  return (
    <div className="flex flex-1 flex-col justify-end gap-3 px-4 pb-4" aria-busy="true" aria-label="Loading messages">
      {rows.map((r, i) => (
        <div key={i} className={cn("flex items-end gap-2", r.mine ? "justify-end" : "justify-start")}>
          {!r.mine && <Skeleton className="size-9" />}
          <Skeleton className={cn("h-11 max-w-[70%]", r.w)} />
        </div>
      ))}
    </div>
  );
}
