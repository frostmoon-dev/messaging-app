"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat, usePresence } from "@/components/providers/ChatProvider";
import {
  CheckIcon,
  CloseIcon,
  EditIcon,
  ImageIcon,
  KeyboardIcon,
  ReplyIcon,
  SendIcon,
  SmileIcon,
  StickerIcon,
  TextStyleIcon,
} from "@/components/ui/icons";
import { StickerPicker } from "./StickerPicker";
import { EmojiPanel } from "./EmojiPanel";
import { STYLE_OPTIONS, styleClass } from "@/lib/messages/styles";
import type { MessageStyle } from "@/lib/messages/api";
import { friendlyError } from "@/lib/errors";
import type { ChatMessage } from "@/types/app";
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
  editing,
  onCancelEdit,
  onSent,
}: {
  replyTo: string | null;
  onCancelReply: () => void;
  /** Your message being edited (text only), or null. */
  editing: ChatMessage | null;
  onCancelEdit: () => void;
  onSent: () => void;
}) {
  const { sendText, sendImage, sendMedia, editMessage, getSnippet, me, partner } = useChat();
  const [style, setStyle] = useState<MessageStyle | null>(null);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Your unsent draft, put back after an edit.
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  const { notifyTyping, stopTyping } = usePresence();
  const isTouch = useIsTouch();
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const replySnippet = replyTo ? getSnippet(replyTo) : undefined;
  const trimmed = text.trim();
  const tooLong = text.length > MAX_MESSAGE_LENGTH;
  const canSend = editing
    ? !tooLong && trimmed.length > 0 && !saving
    : !tooLong && (attachment?.state === "ready" || (trimmed.length > 0 && attachment?.state !== "processing"));

  // Starting an edit puts the message in the box (and keeps your draft for after).
  const editingId = editing?.id ?? null;
  const [shownEdit, setShownEdit] = useState<string | null>(null);
  if (editingId !== shownEdit) {
    setShownEdit(editingId);
    setEditError(null);
    if (editing) {
      setDraft(text);
      setText(editing.content ?? "");
      setStylesOpen(false);
    } else {
      setText(draft);
      setDraft("");
    }
  }
  useEffect(() => {
    if (!editingId) return;
    const el = textareaRef.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [editingId]);

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    notifyTyping();
    requestAnimationFrame(() => {
      const caret = start + emoji.length;
      textareaRef.current?.setSelectionRange(caret, caret);
    });
  };

  const toggleEmoji = () => {
    if (emojiOpen) {
      setEmojiOpen(false);
      textareaRef.current?.focus();
      return;
    }
    // Phones: the panel takes the keyboard's place.
    if (isTouch) textareaRef.current?.blur();
    setEmojiOpen(true);
  };

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
    if (editing) {
      setSaving(true);
      setEditError(null);
      editMessage(editing.id, text)
        .then(() => {
          setSaving(false);
          onCancelEdit();
        })
        .catch((error: { message?: string }) => {
          setSaving(false);
          setEditError(
            error?.message?.includes("TOO_LATE")
              ? "Messages can only be edited for 15 minutes."
              : friendlyError(error, "save"),
          );
        });
      return;
    }
    if (attachment?.state === "ready") {
      sendImage(attachment.image, trimmed, replyTo);
      setAttachment(null);
    } else if (!sendText(text, replyTo, style)) {
      return;
    }
    setText("");
    setStyle(null);
    setStylesOpen(false);
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
    if (e.key === "Escape" && editing) onCancelEdit();
    else if (e.key === "Escape" && replyTo) onCancelReply();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      void attachFile(file);
    }
  };

  return (
    // Phones: the tab bar below already clears the home indicator, so the same 8px above and below.
    // A shade lighter than the tab bar, so typing and navigating read as two areas.
    <div className="relative shrink-0 border-t border-border bg-panel pb-2 lg:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            key="edit"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 pt-2">
              <EditIcon size={18} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-meta font-bold">Editing message</p>
                <p className={cn("truncate text-small", editError ? "text-danger" : "text-muted-strong")} role={editError ? "alert" : undefined}>
                  {editError ?? editing.content}
                </p>
              </div>
              <button
                type="button"
                onClick={onCancelEdit}
                className="-mr-2.5 flex size-11 items-center justify-center rounded-full text-muted-strong hover:bg-panel-strong hover:text-foreground"
                aria-label="Cancel editing"
              >
                <CloseIcon size={18} />
              </button>
            </div>
          </motion.div>
        )}

        {stylesOpen && !editing && (
          <motion.div
            key="styles"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div className="scroll-area flex gap-2 overflow-x-auto px-4 pt-2 pb-0.5" role="radiogroup" aria-label="Message style">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={style === option.id}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setStyle(option.id)}
                  className={cn(
                    "pill flex min-h-10 shrink-0 items-center gap-2 border-2 px-3.5 text-small font-semibold transition-colors",
                    style === option.id ? "border-accent bg-accent-soft text-foreground" : "border-field-border text-muted-strong hover:text-foreground",
                  )}
                >
                  <span className={cn("leading-none", styleClass(option.id) || "text-body")} aria-hidden="true">
                    {option.sample}
                  </span>
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {replyTo && !editing && (
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
              <button type="button" onClick={onCancelReply} className="-mr-2.5 flex size-11 items-center rounded-full justify-center text-muted-strong hover:bg-panel-strong hover:text-foreground" aria-label="Cancel reply">
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
                className="rounded-full flex size-11 items-center justify-center text-muted-strong hover:bg-panel-strong hover:text-foreground"
                aria-label="Remove photo"
              >
                <CloseIcon size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        className="flex items-end gap-2 px-4 pt-2"
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
        {!editing && (<>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => fileRef.current?.click()}
          // Pulled left so the icon lines up with the 16px edge the messages use.
          className="-ml-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-strong hover:bg-panel-strong hover:text-foreground"
          aria-label="Attach a photo"
        >
          <ImageIcon />
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => setPicking(true)}
          className="rounded-full -ml-2 flex size-11 shrink-0 items-center justify-center text-muted-strong hover:bg-panel-strong hover:text-foreground"
          aria-label="Stickers and GIFs"
          aria-haspopup="dialog"
        >
          <StickerIcon />
        </motion.button>
        </>)}

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
            onFocus={() => {
              // Tapping the box brings the keyboard back instead of the emoji panel.
              if (isTouch) setEmojiOpen(false);
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={attachment?.state === "ready" ? "Add a caption" : `Message ${partner.display_name}`}
            enterKeyHint={isTouch ? "enter" : "send"}
            autoComplete="off"
            className={cn(
              "block max-h-36 min-h-11 w-full resize-none rounded-[22px] border-2 border-field-border bg-background pl-4 shadow-[var(--shadow-inset)] py-[10px]",
              // Room for the buttons inside the box on the right.
              text.trim() && !editing ? "pr-[5.25rem]" : "pr-11",
              (!editing && styleClass(style)) || "text-body leading-[1.45]",
              "placeholder:text-muted focus:border-accent focus:outline-none focus-visible:outline-none",
              tooLong && "border-danger",
            )}
            aria-invalid={tooLong || undefined}
            aria-describedby={tooLong ? "composer-count" : undefined}
          />
          <div className="absolute right-1 bottom-0 flex h-11 items-center">
            {text.trim() && !editing && (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setStylesOpen((open) => !open)}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full transition-colors hover:bg-panel-strong",
                  style || stylesOpen ? "text-foreground" : "text-muted-strong",
                )}
                aria-label={style ? `Message style: ${STYLE_OPTIONS.find((o) => o.id === style)?.label}` : "Message style"}
                aria-expanded={stylesOpen}
              >
                <TextStyleIcon size={20} />
              </button>
            )}
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={toggleEmoji}
              className={cn(
                "flex size-10 items-center justify-center rounded-full transition-colors hover:bg-panel-strong",
                emojiOpen ? "text-foreground" : "text-muted-strong",
              )}
              aria-label={emojiOpen ? "Show keyboard" : "Emoji"}
              aria-expanded={emojiOpen}
            >
              {emojiOpen && isTouch ? <KeyboardIcon size={20} /> : <SmileIcon size={20} />}
            </button>
          </div>
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
            "pill flex h-11 w-13 shrink-0 items-center justify-center transition-colors",
            canSend ? "bg-accent text-accent-foreground hover:bg-accent-hover" : "bg-panel-strong text-muted",
          )}
          aria-label={editing ? "Save edit" : "Send message"}
        >
          {editing ? <CheckIcon size={20} /> : <SendIcon size={20} />}
        </motion.button>
      </form>
      <AnimatePresence initial={false}>
        {emojiOpen && (
          <motion.div
            key="emoji"
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <EmojiPanel onPick={insertEmoji} className="mt-2 h-[min(17.5rem,42dvh)]" />
          </motion.div>
        )}
      </AnimatePresence>
      {picking && (
        <StickerPicker
          onClose={() => setPicking(false)}
          onPick={(media) => {
            sendMedia(media, replyTo);
            setPicking(false);
            onCancelReply();
            onSent();
          }}
        />
      )}
    </div>
  );
}
