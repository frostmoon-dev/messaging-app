"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat, usePresence } from "@/components/providers/ChatProvider";
import { CloseIcon, ImageIcon, ReplyIcon, SendIcon } from "@/components/ui/icons";
import { snippetText } from "./ReplyQuote";
import { MAX_MESSAGE_LENGTH } from "@/lib/messages/validation";
import { ImageValidationError, prepareImage, type PreparedImage } from "@/lib/storage/image";
import { useIsTouch } from "@/lib/hooks/useMediaQuery";
import { MESSAGES } from "@/lib/errors";
import { cn, devLog } from "@/lib/utils";

const MAX_TEXTAREA_HEIGHT = 144;

type Attachment =
  | { state: "processing"; name: string }
  | { state: "ready"; image: PreparedImage; previewUrl: string }
  | { state: "error"; message: string };

export function MessageComposer({
  replyTo,
  onCancelReply,
  onSent,
}: {
  replyTo: string | null;
  onCancelReply: () => void;
  onSent: () => void;
}) {
  const { sendText, sendImage, getSnippet, me, partner } = useChat();
  const { notifyTyping, stopTyping } = usePresence();
  const isTouch = useIsTouch();
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const replySnippet = replyTo ? getSnippet(replyTo) : undefined;
  const trimmed = text.trim();
  const tooLong = text.length > MAX_MESSAGE_LENGTH;
  const canSend = !tooLong && (attachment?.state === "ready" || (trimmed.length > 0 && attachment?.state !== "processing"));

  // Auto-grow the textarea up to a limit, then scroll inside it.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [text]);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  // Revoke preview object URLs when they are replaced or on unmount.
  useEffect(() => {
    if (attachment?.state !== "ready") return;
    const url = attachment.previewUrl;
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  const attachFile = async (file: File) => {
    setAttachment({ state: "processing", name: file.name });
    try {
      const image = await prepareImage(file);
      setAttachment({ state: "ready", image, previewUrl: URL.createObjectURL(image.blob) });
    } catch (error) {
      devLog("image prepare failed", error);
      setAttachment({
        state: "error",
        message: error instanceof ImageValidationError ? error.message : MESSAGES.upload,
      });
    }
  };

  const submit = () => {
    if (!canSend) return;
    if (attachment?.state === "ready") {
      sendImage(attachment.image, trimmed, replyTo);
      setAttachment(null);
    } else if (!sendText(text, replyTo)) {
      return;
    }
    setText("");
    onCancelReply();
    onSent();
    stopTyping();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on keyboards; on touch devices Enter makes a new line and
    // the send button sends (native messenger behaviour). Never interrupt
    // an IME composition (Japanese, Chinese, Korean input).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isTouch) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape" && replyTo) onCancelReply();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      void attachFile(file);
    }
  };

  return (
    <div className="relative shrink-0 border-t border-border bg-background-raised pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <AnimatePresence initial={false}>
        {replyTo && (
          <motion.div
            key="reply"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 pt-2">
              <ReplyIcon size={18} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-meta font-bold">
                  Replying to {replySnippet?.sender_id === me.id ? "yourself" : partner.display_name}
                </p>
                <p className="truncate text-small text-muted-strong">{snippetText(replySnippet)}</p>
              </div>
              <button type="button" onClick={onCancelReply} className="flex size-11 items-center justify-center text-muted-strong hover:bg-panel-strong hover:text-foreground" aria-label="Cancel reply">
                <CloseIcon size={18} />
              </button>
            </div>
          </motion.div>
        )}

        {attachment && (
          <motion.div
            key="attachment"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 pt-3">
              {attachment.state === "ready" && (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img
                  src={attachment.previewUrl}
                  alt="Selected photo preview"
                  className="h-16 w-auto max-w-28 object-cover"
                />
              )}
              {attachment.state === "processing" && <div className="skeleton h-16 w-20" aria-hidden="true" />}
              <p
                className={cn("flex-1 text-small", attachment.state === "error" ? "text-danger" : "text-muted-strong")}
                role={attachment.state === "error" ? "alert" : "status"}
              >
                {attachment.state === "processing" && "Preparing photo…"}
                {attachment.state === "ready" && "Photo ready. Add a caption or send."}
                {attachment.state === "error" && attachment.message}
              </p>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="flex size-11 items-center justify-center text-muted-strong hover:bg-panel-strong hover:text-foreground"
                aria-label="Remove photo"
              >
                <CloseIcon size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        className="flex items-end gap-2 px-2 pt-2 sm:px-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void attachFile(file);
          }}
        />
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => fileRef.current?.click()}
          className="flex size-11 shrink-0 items-center justify-center text-muted-strong hover:bg-panel-strong hover:text-foreground"
          aria-label="Attach a photo"
        >
          <ImageIcon />
        </motion.button>

        <div className="relative min-w-0 flex-1">
          <label htmlFor="composer" className="sr-only">
            Message {partner.display_name}
          </label>
          <textarea
            id="composer"
            ref={textareaRef}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim()) notifyTyping();
              else stopTyping();
            }}
            onBlur={stopTyping}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={attachment?.state === "ready" ? "Add a caption" : `Message ${partner.display_name}`}
            enterKeyHint={isTouch ? "enter" : "send"}
            autoComplete="off"
            className={cn(
              "block max-h-36 min-h-11 w-full resize-none border-2 border-field-border bg-panel px-4 py-[10px] text-body leading-[1.45]",
              "placeholder:text-muted focus:border-accent focus:outline-none",
              tooLong && "border-danger",
            )}
            aria-invalid={tooLong || undefined}
            aria-describedby={tooLong ? "composer-count" : undefined}
          />
          {text.length > MAX_MESSAGE_LENGTH - 400 && (
            <span
              id="composer-count"
              className={cn("absolute right-3 -top-5 font-mono text-meta", tooLong ? "text-danger" : "text-muted")}
            >
              {text.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>

        <motion.button
          type="submit"
          disabled={!canSend}
          whileTap={canSend ? { scale: 0.92 } : undefined}
          // Keep the keyboard open on mobile after tapping send.
          onPointerDown={(e) => e.preventDefault()}
          className={cn(
            "p5-button flex h-11 w-13 shrink-0 items-center justify-center transition-colors",
            canSend ? "bg-accent text-accent-foreground hover:bg-accent-hover" : "bg-panel-strong text-muted",
          )}
          aria-label="Send message"
        >
          <SendIcon size={20} />
        </motion.button>
      </form>
    </div>
  );
}
