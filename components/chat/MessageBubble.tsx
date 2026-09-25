"use client";

import { memo, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { MoreIcon, PinIcon, ReplyIcon, RetryIcon, StarIcon, TrashIcon } from "@/components/ui/icons";
import { MessageStatus } from "./MessageStatus";
import { ReplyQuote } from "./ReplyQuote";
import { MessageGif, MessageSticker } from "./MessageSticker";
import { MessageImage } from "./MessageImage";
import { HeartBurst } from "./HeartBurst";
import { formatTime } from "@/lib/time";
import { haptic } from "@/lib/haptics";
import { styleClass } from "@/lib/messages/styles";
import { isEmojiOnly, tokenize } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { ChatMessage, Profile, ReplySnippet } from "@/types/app";

type Props = {
  message: ChatMessage;
  mine: boolean;
  firstInGroup: boolean;
  lastInGroup: boolean;
  animateIn: boolean;
  highlighted: boolean;
  swipeEnabled: boolean;
  author: Profile;
  replySnippet: ReplySnippet | undefined;
  replyAuthorName: string;
  localPreview?: string;
  onReply: (id: string) => void;
  onJump: (id: string) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onOpenImage: (src: string, alt: string) => void;
  /** Opens Reply / Copy / Delete for this message (long-press, right-click or "…"). */
  onActions: (id: string) => void;
  /** You starred it (only you see this). */
  starred?: boolean;
  /** Your id, to find your own reaction. */
  myId: string;
  /** person id → emoji. */
  reactions?: Readonly<Record<string, string>>;
  onReact: (id: string, emoji: string | null) => void;
  /** Your newest message, once they've read it: "Seen 14:02". */
  seenAt?: string | null;
};

const HEART = "❤️";
const DOUBLE_TAP_MS = 300;

const LONG_PRESS_MS = 450;

const SWIPE_THRESHOLD = 56;

function MessageBubbleImpl({
  message,
  mine,
  firstInGroup,
  lastInGroup,
  animateIn,
  highlighted,
  swipeEnabled,
  author,
  replySnippet,
  replyAuthorName,
  localPreview,
  onReply,
  onJump,
  onRetry,
  onDiscard,
  onOpenImage,
  onActions,
  starred = false,
  myId,
  reactions,
  onReact,
  seenAt,
}: Props) {
  const x = useMotionValue(0);
  const hintOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const failed = message.local?.status === "failed";
  const deleted = Boolean(message.deleted_at);
  const canAct = !message.local && !deleted;
  // A "Message deleted" marker can still be removed from your view (Delete for me).
  const canOpenActions = !message.local;
  const myReaction = reactions?.[myId] ?? null;
  const [burst, setBurst] = useState(0);

  // Double-tap (or double-click) a message: heart it, or take the heart back.
  const toggleHeart = () => {
    if (!canAct) return;
    const adding = myReaction !== HEART;
    onReact(message.id, adding ? HEART : null);
    haptic(adding ? "heart" : "press");
    if (adding) setBurst((n) => n + 1);
  };
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  // Long-press (phones): hold still for a moment. Moving (scroll or swipe-to-reply) cancels it.
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  const pressHandlers = canOpenActions
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          if (e.pointerType === "mouse") return;
          cancelPress();
          press.current = {
            x: e.clientX,
            y: e.clientY,
            timer: setTimeout(() => {
              press.current = null;
              // iPhone may already have started selecting a word; drop it.
              window.getSelection()?.removeAllRanges();
              lastTap.current = null;
              haptic("press");
              onActions(message.id);
            }, LONG_PRESS_MS),
          };
        },
        onPointerMove: (e: React.PointerEvent) => {
          if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) cancelPress();
        },
        onPointerUp: (e: React.PointerEvent) => {
          // Still pressed = a short tap that didn't move. Two of them quickly = a heart.
          const tapped = press.current !== null;
          cancelPress();
          if (!tapped || !canAct || message.message_type === "image") return;
          const now = Date.now();
          const prev = lastTap.current;
          if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
            lastTap.current = null;
            e.preventDefault();
            toggleHeart();
          } else {
            lastTap.current = { t: now, x: e.clientX, y: e.clientY };
          }
        },
        onDoubleClick: (e: React.MouseEvent) => {
          if (message.message_type === "image") return;
          e.preventDefault();
          window.getSelection()?.removeAllRanges();
          toggleHeart();
        },
        onPointerCancel: cancelPress,
        onContextMenu: (e: React.MouseEvent) => {
          e.preventDefault();
          cancelPress();
          onActions(message.id);
        },
      }
    : {};
  const emojiOnly = message.message_type === "text" && isEmojiOnly(message.content);
  // Stickers and GIFs sit on the chat without a bubble; their `content` is a description, not text to show.
  const media = message.message_type === "sticker" || message.message_type === "gif";
  const bare = (emojiOnly || media) && !deleted;
  const tokens = useMemo(() => (message.content ? tokenize(message.content) : []), [message.content]);
  const time = formatTime(message.created_at);
  // The time shows under the last message of a group, and on any pinned or starred one (for its mark).
  const edited = Boolean(message.edited_at) && !deleted;
  const showMeta =
    lastInGroup || Boolean(message.local) || Boolean(seenAt) || (!deleted && (Boolean(message.pinned_at) || starred || edited));
  // Each emoji once, with how many of you picked it.
  const reactionList = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(reactions ?? {}).forEach((e) => counts.set(e, (counts.get(e) ?? 0) + 1));
    return [...counts.entries()];
  }, [reactions]);
  const reactionCount = Object.keys(reactions ?? {}).length;
  const styled = message.message_type === "text" && !emojiOnly ? styleClass(message.style) : "";

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) onReply(message.id);
  };

  // Only new messages move, and only a little: enough to notice, not to wait for.
  const entrance = animateIn ? { opacity: 0, y: 8 } : false;

  return (
    <motion.div
      id={`msg-${message.id}`}
      initial={entrance}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        // message-touch: no text selection or callout on touch screens (long-press opens the options; Copy is there).
        "message-touch group relative flex w-full items-end gap-2 px-4",
        mine ? "justify-end" : "justify-start",
        firstInGroup ? "mt-4" : "mt-1",
      )}
    >
      {/* Brief highlight after jumping to a replied message. */}
      {highlighted && (
        <motion.span
          className="pointer-events-none absolute inset-y-[-4px] inset-x-0 bg-accent-soft"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          aria-hidden="true"
        />
      )}

      {!mine && (
        <div className="w-9 shrink-0 self-end">
          {lastInGroup && <Avatar profile={author} size="sm" />}
        </div>
      )}

      <div className={cn("relative flex max-w-[min(82%,34rem)] flex-col sm:max-w-[min(68%,34rem)]", mine ? "items-end" : "items-start")}>
        {swipeEnabled && (
          <motion.span
            style={{ opacity: hintOpacity }}
            className="absolute top-1/2 -left-8 -translate-y-1/2 text-accent-text"
            aria-hidden="true"
          >
            <ReplyIcon size={20} />
          </motion.span>
        )}

        <motion.div
          drag={swipeEnabled && canAct ? "x" : false}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 0.35 }}
          dragSnapToOrigin
          onDragEnd={onDragEnd}
          style={{ x, touchAction: "pan-y" }}
          className="relative min-w-0"
          {...pressHandlers}
        >
          <div
            className={cn(
              "relative overflow-hidden",
              deleted
                ? cn(mine ? "bubble-out" : "bubble-in", "border border-dashed border-field-border bg-transparent px-4 py-2.5 text-muted shadow-none")
                : bare
                ? cn("bg-transparent", emojiOnly && "px-1 py-0.5")
                : cn(
                    mine ? "bubble-out bg-outgoing text-outgoing-foreground" : "bubble-in bg-incoming text-incoming-foreground",
                    message.message_type === "image" ? "p-1.5" : "px-4 py-2.5",
                  ),
              failed && "opacity-70",
            )}
          >
            <span className="sr-only">{mine ? "You" : author.display_name}:</span>

            {deleted && (
              <p className="text-body leading-[1.45]">{mine ? "You deleted this message" : "Message deleted"}</p>
            )}

            {!deleted && message.reply_to && (
              <ReplyQuote
                snippet={replySnippet}
                authorName={replyAuthorName}
                onClick={() => onJump(message.reply_to!)}
                className={message.message_type === "image" || media ? "rounded-[14px]" : "rounded-[10px]"}
              />
            )}

            {!deleted && message.message_type === "image" && (
              <MessageImage
                message={message}
                localPreview={localPreview}
                onOpen={onOpenImage}
                // Inner corners = bubble corners (20px, 6px at the tail) minus the 6px padding.
                className={cn(
                  "rounded-[14px]",
                  !message.content && (mine ? "rounded-br-[2px]" : "rounded-bl-[2px]"),
                )}
              />
            )}

            {!deleted && message.message_type === "sticker" && <MessageSticker message={message} />}
            {!deleted && message.message_type === "gif" && (
              <MessageGif message={message} tailClass={mine ? "rounded-br-[6px]" : "rounded-bl-[6px]"} />
            )}

            {message.content && !media && (
              <p
                className={cn(
                  "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                  emojiOnly ? "text-4xl leading-tight" : styled || "text-body leading-[1.45]",
                  message.message_type === "image" && "px-2 pt-1.5 pb-1",
                )}
              >
                {tokens.map((t, i) =>
                  t.type === "link" ? (
                    <a
                      key={i}
                      href={t.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="underline underline-offset-2"
                    >
                      {t.value}
                    </a>
                  ) : (
                    <span key={i}>{t.value}</span>
                  ),
                )}
              </p>
            )}
          </div>
          <AnimatePresence>{burst > 0 && <HeartBurst key={burst} />}</AnimatePresence>
        </motion.div>

        {reactionCount > 0 && !deleted && (
          <motion.button
            type="button"
            key={reactionList.map(([e]) => e).join("")}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 18 }}
            onClick={() => onActions(message.id)}
            className={cn(
              "chat-meta relative z-10 -mt-2.5 flex min-h-7 items-center gap-0.5 rounded-full bg-love-soft px-2 text-[0.9375rem] leading-none",
              "shadow-[inset_0_0_0_1.5px_var(--love),var(--shadow-raised)]",
              mine ? "mr-2" : "ml-2",
            )}
            aria-label={`Reactions: ${reactionList.map(([e, n]) => (n > 1 ? `${e} ×${n}` : e)).join(", ")}. Open options`}
          >
            {reactionList.map(([e]) => (
              <span key={e} aria-hidden="true">
                {e}
              </span>
            ))}
            {reactionCount > 1 && reactionList.length === 1 && (
              <span className="ml-0.5 font-mono text-meta font-semibold text-muted-strong" aria-hidden="true">
                {reactionCount}
              </span>
            )}
          </motion.button>
        )}

        {showMeta && (
          <div
            className={cn(
              "chat-meta mt-1 flex items-center gap-1.5 px-1 font-mono text-meta font-medium text-muted",
              mine ? "flex-row" : "flex-row-reverse",
            )}
          >
            {message.pinned_at && !deleted && (
              <span className="flex" title="Pinned">
                <PinIcon size={12} aria-hidden="true" />
                <span className="sr-only">Pinned.</span>
              </span>
            )}
            {starred && !deleted && (
              <span className="flex" title="In your favourites">
                <StarIcon size={12} fill="currentColor" aria-hidden="true" />
                <span className="sr-only">In your favourites.</span>
              </span>
            )}
            {edited && <span className="font-sans">edited</span>}
            <time dateTime={message.created_at}>{time}</time>
            {mine && <MessageStatus message={message} />}
            {seenAt && <span className="font-sans font-semibold text-love">Seen {formatTime(seenAt)}</span>}
          </div>
        )}
        {!showMeta && <span className="sr-only">{time}</span>}

        {failed && (
          <div className="chat-meta mt-1 flex flex-wrap items-center gap-1 text-small text-danger" role="alert">
            <span>{message.local?.error ?? "Couldn't send message."}</span>
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              className="rounded-full inline-flex min-h-11 items-center gap-1 px-2 font-semibold text-foreground hover:bg-panel-strong"
            >
              <RetryIcon size={14} /> Retry
            </button>
            <button
              type="button"
              onClick={() => onDiscard(message.id)}
              className="rounded-full inline-flex size-11 items-center justify-center text-muted hover:bg-panel-strong hover:text-foreground"
              aria-label="Delete unsent message"
            >
              <TrashIcon size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Mouse and keyboard: Reply and "…" (more) appear on hover or focus. Phones use swipe and long-press. */}
      {canAct && (
        <div
          className={cn(
            "flex self-center opacity-0 group-hover:opacity-100 focus-within:opacity-100",
            "[@media(pointer:coarse)]:sr-only",
            mine ? "order-first flex-row-reverse" : "",
          )}
        >
          <button
            type="button"
            onClick={() => onReply(message.id)}
            className="rounded-full p-2 text-muted hover:bg-panel-strong hover:text-foreground"
            aria-label={`Reply to ${mine ? "your" : `${author.display_name}'s`} message`}
          >
            <ReplyIcon size={18} />
          </button>
          <button
            type="button"
            onClick={() => onActions(message.id)}
            className="rounded-full p-2 text-muted hover:bg-panel-strong hover:text-foreground"
            aria-label="More options for this message"
            aria-haspopup="dialog"
          >
            <MoreIcon size={18} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
