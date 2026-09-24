"use client";

import { memo, useMemo } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { ReplyIcon, RetryIcon, TrashIcon } from "@/components/ui/icons";
import { MessageStatus } from "./MessageStatus";
import { ReplyQuote } from "./ReplyQuote";
import { MessageImage } from "./MessageImage";
import { formatTime } from "@/lib/time";
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
};

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
}: Props) {
  const x = useMotionValue(0);
  const hintOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const failed = message.local?.status === "failed";
  const emojiOnly = message.message_type === "text" && isEmojiOnly(message.content);
  const tokens = useMemo(() => (message.content ? tokenize(message.content) : []), [message.content]);
  const time = formatTime(message.created_at);
  const showMeta = lastInGroup || Boolean(message.local);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) onReply(message.id);
  };

  const entrance = animateIn
    ? mine
      ? { opacity: 0, x: 28, skewX: -8 }
      : { opacity: 0, x: -22, skewX: 6 }
    : false;

  return (
    <motion.div
      id={`msg-${message.id}`}
      initial={entrance}
      animate={{ opacity: 1, x: 0, skewX: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.9, 0.1, 1] }}
      className={cn(
        "group relative flex w-full items-end gap-2 px-3 sm:px-5",
        mine ? "justify-end" : "justify-start",
        firstInGroup ? "mt-3" : "mt-1",
      )}
    >
      {/* Brief highlight after jumping to a replied message. */}
      {highlighted && (
        <motion.span
          className="pointer-events-none absolute inset-y-[-4px] inset-x-0 -skew-x-6 bg-accent/25"
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

      <div className={cn("relative flex max-w-[82%] flex-col sm:max-w-[68%]", mine ? "items-end" : "items-start")}>
        {swipeEnabled && (
          <motion.span
            style={{ opacity: hintOpacity }}
            className="absolute top-1/2 -left-8 -translate-y-1/2 text-accent-strong"
            aria-hidden="true"
          >
            <ReplyIcon size={20} />
          </motion.span>
        )}

        <motion.div
          drag={swipeEnabled && !message.local ? "x" : false}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 0.35 }}
          dragSnapToOrigin
          onDragEnd={onDragEnd}
          style={{ x, touchAction: "pan-y" }}
          className={cn("relative min-w-0", mine ? "shadow-outgoing" : "shadow-incoming")}
        >
          <div
            className={cn(
              "relative overflow-hidden",
              emojiOnly
                ? "bg-transparent px-1 py-0.5"
                : cn(
                    mine
                      ? "shape-outgoing bg-outgoing text-outgoing-foreground"
                      : "shape-incoming bg-incoming text-incoming-foreground",
                    message.message_type === "image" ? "p-1.5" : "px-3.5 py-2.5",
                  ),
              failed && "opacity-70",
            )}
          >
            {!mine && animateIn && (
              <motion.span
                className="pointer-events-none absolute inset-0 bg-accent"
                initial={{ opacity: 0.55 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                aria-hidden="true"
              />
            )}

            <span className="sr-only">{mine ? "You" : author.display_name}:</span>

            {message.reply_to && (
              <ReplyQuote
                snippet={replySnippet}
                authorName={replyAuthorName}
                onClick={() => onJump(message.reply_to!)}
                tone={mine ? "outgoing" : "incoming"}
              />
            )}

            {message.message_type === "image" && (
              <MessageImage message={message} localPreview={localPreview} onOpen={onOpenImage} />
            )}

            {message.content && (
              <p
                className={cn(
                  "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                  emojiOnly ? "text-4xl leading-tight" : "text-[15px] leading-[1.45]",
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
                      className="underline decoration-2 underline-offset-2"
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
        </motion.div>

        {showMeta && (
          <div
            className={cn(
              "mt-1 flex items-center gap-1.5 px-1 text-[11px] tabular-nums text-muted",
              mine ? "flex-row" : "flex-row-reverse",
            )}
          >
            <time dateTime={message.created_at}>{time}</time>
            {mine && <MessageStatus message={message} />}
          </div>
        )}
        {!showMeta && <span className="sr-only">{time}</span>}

        {failed && (
          <div className="mt-1 flex items-center gap-1 text-[12px] text-danger" role="alert">
            <span>{message.local?.error ?? "Couldn't send message."}</span>
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              className="text-display inline-flex min-h-8 items-center gap-1 px-2 tracking-wider text-foreground hover:text-accent-strong"
            >
              <RetryIcon size={14} /> Retry
            </button>
            <button
              type="button"
              onClick={() => onDiscard(message.id)}
              className="inline-flex min-h-8 items-center px-1.5 text-muted hover:text-foreground"
              aria-label="Delete unsent message"
            >
              <TrashIcon size={14} />
            </button>
          </div>
        )}
      </div>

      {!message.local && (
        <button
          type="button"
          onClick={() => onReply(message.id)}
          className={cn(
            "self-center p-2 text-muted opacity-0 transition-opacity hover:text-accent-strong focus-visible:opacity-100 group-hover:opacity-100",
            "[@media(pointer:coarse)]:sr-only",
            mine ? "order-first" : "",
          )}
          aria-label={`Reply to ${mine ? "your" : `${author.display_name}'s`} message`}
        >
          <ReplyIcon size={18} />
        </button>
      )}
    </motion.div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
