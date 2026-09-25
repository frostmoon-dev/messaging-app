"use client";

import { ArrowDownIcon } from "@/components/ui/icons";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { MessageBubble } from "./MessageBubble";
import { EmptyChat } from "./EmptyChat";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { formatDayLabel, formatTime, isSameDay, minutesApart } from "@/lib/time";
import { useIsTouch } from "@/lib/hooks/useMediaQuery";
import { cn, devLog } from "@/lib/utils";
import { SLAM_EVENT } from "@/lib/messages/effects";

const GROUP_GAP_MINUTES = 5;
// Like iMessage: a centred "Today 10:43" only after a break this long.
const TIME_HEADER_GAP_MINUTES = 60;
const BOTTOM_THRESHOLD = 96;
// How far the chat slides when you swipe left to see times.
const REVEAL_MAX = 64;

export function MessageList({
  highlightedId,
  onReply,
  onJump,
  onOpenImage,
  onActions,
}: {
  highlightedId: string | null;
  onReply: (id: string) => void;
  onJump: (id: string) => void;
  onOpenImage: (src: string, alt: string) => void;
  onActions: (id: string) => void;
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
    starred,
    reactions,
    react,
  } = useChat();
  const isTouch = useIsTouch();

  // Bubbles only show a name and photo. Profiles change every 30 s (last
  // seen), so hand bubbles objects that change only when those two do;
  // otherwise every bubble would redraw twice a minute for nothing.
  const meAuthor = useMemo(() => me, [me.id, me.display_name, me.avatar_url]); // eslint-disable-line react-hooks/exhaustive-deps
  const partnerAuthor = useMemo(() => partner, [partner.id, partner.display_name, partner.avatar_url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Like iMessage, one line under your newest message: "Delivered", or
  // "Seen 14:02" once they've read it. Nothing under older ones.
  const receipt = useMemo(() => {
    const newestMine = messages.findLast((m) => m.sender_id === me.id);
    if (!newestMine || newestMine.local || newestMine.deleted_at) return null;
    // Only while it's still the latest thing said, as iMessage does.
    if (messages.at(-1)?.id !== newestMine.id && !newestMine.read_at) return null;
    const label = newestMine.read_at
      ? `Seen ${formatTime(newestMine.read_at)}`
      : newestMine.delivered_at
        ? "Delivered"
        : "Sent";
    return { id: newestMine.id, label };
  }, [messages, me.id]);

  const onReact = useCallback(
    (id: string, emoji: string | null) => void react(id, emoji).catch((error) => devLog("reaction failed", error)),
    [react],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Swipe left anywhere on the chat to see every message's time, like
  // iMessage. Written straight to CSS variables: no re-render per frame.
  const swipe = useRef<{ x: number; y: number; on: boolean | null } | null>(null);
  const revealRest = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(revealRest.current), []);
  const setReveal = (px: number, dragging: boolean) => {
    const el = contentRef.current;
    if (!el) return;
    if (dragging) clearTimeout(revealRest.current);
    el.style.setProperty("--reveal", `${px}px`);
    el.style.setProperty("--reveal-o", String(px / REVEAL_MAX));
    // "0px 0" (not none) while it slides back, so the return animates; then none.
    el.style.setProperty("--reveal-x", `${-px}px 0`);
    el.dataset.revealing = String(dragging);
    if (!dragging && px === 0) {
      clearTimeout(revealRest.current);
      revealRest.current = setTimeout(() => el.style.removeProperty("--reveal-x"), 320);
    }
  };
  const swipeHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      swipe.current = { x: e.clientX, y: e.clientY, on: null };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = swipe.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      // Decide once: a leftward sideways move reveals; anything else scrolls or replies.
      if (s.on === null && Math.hypot(dx, dy) > 8) s.on = dx < 0 && Math.abs(dx) > Math.abs(dy) * 1.2;
      if (s.on) setReveal(Math.min(REVEAL_MAX, Math.max(0, -dx)), true);
    },
    onPointerUp: () => {
      if (swipe.current?.on) setReveal(0, false);
      swipe.current = null;
    },
    onPointerCancel: () => {
      if (swipe.current?.on) setReveal(0, false);
      swipe.current = null;
    },
  };
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  // Only messages newer than what was on screen at first load get an entrance.
  const [baseline, setBaseline] = useState<string | null>(null);
  const lastIdRef = useRef<string | null>(null);

  if (loaded && baseline === null) {
    const newest = messages.filter((m) => !m.local).at(-1);
    setBaseline(newest?.created_at ?? "");
  }

  // A normal top-to-bottom list, kept on the newest message in code. (It used
  // to be `flex-col-reverse`, which iPhone Safari sometimes painted at a stale
  // scroll position after you came back to the chat: a gap at the bottom and
  // photos drawn over other messages.)
  // pinned: you're following the newest message, so size changes keep you there.
  const pinnedRef = useRef(true);
  const distanceFromBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight;

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduce ? "smooth" : "auto" });
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = distanceFromBottom(el) < BOTTOM_THRESHOLD;
    pinnedRef.current = bottom;
    setAtBottom(bottom);
    if (bottom) setUnseen(0);
  };

  // Arriving at the chat: start at the newest message.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!loaded || !el) return;
    el.scrollTop = el.scrollHeight;
    pinnedRef.current = true;
  }, [loaded]);

  // Whenever anything changes size (a photo or GIF loads, the keyboard opens,
  // a reaction appears), stay on the newest message if you were there. Not
  // while your finger is on the chat or a flick is still gliding: jumping
  // then stops the scroll dead and feels stuck.
  const heightRef = useRef(0);
  const interactingUntil = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!loaded || !el || !content) return;
    const pin = () => {
      if (pinnedRef.current && performance.now() >= interactingUntil.current) el.scrollTop = el.scrollHeight;
      heightRef.current = el.scrollHeight;
    };
    const touchStart = () => (interactingUntil.current = Infinity);
    // A flick keeps gliding for a moment after the finger lifts.
    const touchEnd = () => {
      interactingUntil.current = performance.now() + 700;
      setTimeout(pin, 720);
    };
    const wheel = () => (interactingUntil.current = performance.now() + 300);
    const observer = new ResizeObserver(pin);
    observer.observe(el);
    observer.observe(content);
    el.addEventListener("touchstart", touchStart, { passive: true });
    el.addEventListener("touchend", touchEnd, { passive: true });
    el.addEventListener("touchcancel", touchEnd, { passive: true });
    el.addEventListener("wheel", wheel, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("touchstart", touchStart);
      el.removeEventListener("touchend", touchEnd);
      el.removeEventListener("touchcancel", touchEnd);
      el.removeEventListener("wheel", wheel);
    };
  }, [loaded]);

  // Older messages loaded above: keep what you were reading in place.
  const firstIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = messages[0]?.id ?? null;
    if (firstIdRef.current && first !== firstIdRef.current && !pinnedRef.current) {
      el.scrollTop += el.scrollHeight - heightRef.current;
    }
    firstIdRef.current = first;
    heightRef.current = el.scrollHeight;
  });

  // React to a new last message: follow my own sends and, when you're at the
  // bottom, theirs; count theirs that arrive while you're scrolled up.
  useLayoutEffect(() => {
    const last = messages.at(-1);
    if (!last || last.id === lastIdRef.current) return;
    const isFirst = lastIdRef.current === null;
    lastIdRef.current = last.id;
    if (isFirst) return;
    if (last.sender_id === me.id || pinnedRef.current) {
      scrollToBottom();
    } else {
      setUnseen((n) => n + 1);
    }
  }, [messages, me.id, scrollToBottom]);

  // A Slam shakes the whole chat for a moment, like iMessage.
  useEffect(() => {
    const onSlam = () => {
      const el = contentRef.current;
      if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      el.classList.remove("chat-slam");
      void el.offsetWidth; // restart the animation
      el.classList.add("chat-slam");
    };
    window.addEventListener(SLAM_EVENT, onSlam);
    return () => window.removeEventListener(SLAM_EVENT, onSlam);
  }, []);

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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 pt-[calc(var(--chat-header-h,0px)+1.5rem)] text-center" role="alert">
        <p className="text-title font-bold">Messages didn&apos;t load</p>
        <p className="text-small text-muted-strong">{loadError}</p>
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
        // overflow-x hidden: the times wait just off the right edge. pan-y: sideways swipes reach us (pinch still zooms).
        className="scroll-area relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain [overflow-anchor:none] [touch-action:pan-y_pinch-zoom]"
        {...swipeHandlers}
        role="log"
        aria-label={`Conversation with ${partner.display_name}`}
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
      >
        {/* pb-12: room at the end for the typing bubble that floats there. */}
        {/* The header floats over the top (frosted), so the list starts below it. */}
        <div ref={contentRef} className="mt-auto flex flex-col pt-[calc(var(--chat-header-h,0px)+1rem)] pb-12">
          <div ref={topRef} aria-hidden="true" />
          {hasMore && (
            <div className="flex justify-center py-3">
              {loadingOlder ? (
                <span className="chat-meta text-small text-muted">Loading earlier messages…</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadOlder()}
                  className="chat-meta min-h-11 rounded-full px-4 text-small text-muted-strong hover:bg-panel-strong hover:text-foreground"
                >
                  Load earlier messages
                </button>
              )}
            </div>
          )}

          {messages.length === 0 && <EmptyChat />}

          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || !isSameDay(prev.created_at, m.created_at);
            const timeHeader = newDay || minutesApart(prev.created_at, m.created_at) >= TIME_HEADER_GAP_MINUTES;
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
                {timeHeader && <TimeHeader iso={m.created_at} />}
                <MessageBubble
                  message={m}
                  mine={mine}
                  firstInGroup={firstInGroup}
                  lastInGroup={lastInGroup}
                  animateIn={Boolean(m.local) || (baseline !== null && m.created_at > baseline)}
                  highlighted={highlightedId === m.id}
                  swipeEnabled={isTouch}
                  author={mine ? meAuthor : partnerAuthor}
                  replySnippet={snippet}
                  replyAuthorName={snippet ? (snippet.sender_id === me.id ? "You" : partner.display_name) : ""}
                  localPreview={m.message_type === "image" || m.message_type === "voice" ? localPreview(m.id) : undefined}
                  onReply={onReply}
                  onJump={onJump}
                  onRetry={retry}
                  onDiscard={discard}
                  onOpenImage={onOpenImage}
                  onActions={onActions}
                  starred={starred.has(m.id)}
                  myId={me.id}
                  reactions={reactions[m.id]}
                  onReact={onReact}
                  receipt={receipt?.id === m.id ? receipt.label : null}
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
              "pill absolute right-4 bottom-3 flex min-h-11 min-w-12 items-center justify-center gap-2 px-4 text-small font-bold shadow-[var(--shadow-float)]",
              unseen ? "bg-accent text-accent-foreground" : "bg-foreground text-background",
            )}
            aria-label={unseen ? `${unseen} new messages. Scroll to latest.` : "Scroll to latest message"}
          >
            {unseen > 0 && <span>{unseen} new</span>}
            <ArrowDownIcon size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Centred "Today 10:43", like iMessage: the day in bold, the time in plain. */
function TimeHeader({ iso }: { iso: string }) {
  const day = formatDayLabel(iso);
  const time = formatTime(iso);
  return (
    <div className="mt-5 mb-1 flex justify-center px-4" role="separator" aria-label={`${day} ${time}`}>
      <span className="chat-meta text-meta text-muted">
        <span className="font-semibold text-muted-strong">{day}</span> {time}
      </span>
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
    <div className="flex flex-1 flex-col justify-end gap-3 px-4 pt-[var(--chat-header-h,0px)] pb-4" aria-busy="true" aria-label="Loading messages">
      {rows.map((r, i) => (
        <div key={i} className={cn("flex items-end gap-2", r.mine ? "justify-end" : "justify-start")}>
          {!r.mine && <Skeleton className="size-9 rounded-full" />}
          <Skeleton className={cn("h-10 max-w-[70%]", r.w)} />
        </div>
      ))}
    </div>
  );
}
