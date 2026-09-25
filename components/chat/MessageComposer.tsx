"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat, usePresence } from "@/components/providers/ChatProvider";
import {
  CheckIcon,
  CloseIcon,
  PlusIcon,
  EditIcon,
  ImageIcon,
  KeyboardIcon,
  ReplyIcon,
  ArrowUpIcon,
  TrashIcon,
  MicIcon,
  SmileIcon,
  StickerIcon,
  TextStyleIcon,
} from "@/components/ui/icons";
import { StickerPicker } from "./StickerPicker";
import { EmojiPanel } from "./EmojiPanel";
import { STYLE_OPTIONS, styleClass } from "@/lib/messages/styles";
import { EFFECT_OPTIONS, type MessageEffect } from "@/lib/messages/effects";
import type { MessageStyle } from "@/lib/messages/api";
import { friendlyError } from "@/lib/errors";
import type { ChatMessage } from "@/types/app";
import { snippetText } from "./ReplyQuote";
import { MAX_MESSAGE_LENGTH } from "@/lib/messages/validation";
import { ImageValidationError, prepareImage, type PreparedImage } from "@/lib/storage/image";
import { useIsTouch } from "@/lib/hooks/useMediaQuery";
import { MESSAGES } from "@/lib/errors";
import { cn, devLog, uuid } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { formatDuration, MAX_VOICE_MS, RecorderError, startRecording, voiceSupported, type Recorder } from "@/lib/audio/recorder";

const MAX_TEXTAREA_HEIGHT = 144;
const subscribeNoop = () => () => {};

/** One picked photo. The original file is kept so switching HD can redo it. */
type Attachment = {
  key: string;
  file: File;
  /** Bumps on each (re)preparation, so a slow old one can't overwrite a newer result. */
  version: number;
} & (
  | { state: "processing" }
  | { state: "ready"; image: PreparedImage; previewUrl: string }
  | { state: "error"; message: string }
);

// Like WhatsApp's tray, with a sane limit for one go.
const MAX_PHOTOS = 10;

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
  const { sendText, sendImages, sendVoice, sendMedia, editMessage, getSnippet, me, partner } = useChat();
  const [style, setStyle] = useState<MessageStyle | null>(null);
  const [effect, setEffect] = useState<MessageEffect | null>(null);
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [hd, setHd] = useState(false);
  const readyImages = attachments.filter((a): a is Attachment & { state: "ready" } => a.state === "ready");
  const preparing = attachments.some((a) => a.state === "processing");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const replySnippet = replyTo ? getSnippet(replyTo) : undefined;
  const trimmed = text.trim();
  const tooLong = text.length > MAX_MESSAGE_LENGTH;
  const canSend = editing
    ? !tooLong && trimmed.length > 0 && !saving
    : !tooLong && !preparing && (readyImages.length > 0 || trimmed.length > 0);

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

  // Opened from a message pop-up (/chat?reply=1): the box is ready to type.
  // iPhone only opens the keyboard after a tap, so there the box is focused
  // and one tap on it starts typing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reply") !== "1") return;
    params.delete("reply");
    const rest = params.toString();
    window.history.replaceState(null, "", rest ? `/chat?${rest}` : "/chat");
    textareaRef.current?.focus();
  }, []);

  // Preview links are revoked when a photo leaves the tray or the composer goes.
  const previewUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const dropPreview = (a: Attachment | undefined) => {
    if (a?.state === "ready") {
      URL.revokeObjectURL(a.previewUrl);
      previewUrls.current.delete(a.previewUrl);
    }
  };

  // Photos are prepared one at a time: each full-size photo needs tens of MB
  // while it's resized, and several at once can crash Safari on iPhone.
  const prepareQueue = useRef<Promise<void>>(Promise.resolve());
  const prepare = (key: string, file: File, version: number, highRes: boolean) => {
    prepareQueue.current = prepareQueue.current.then(() => prepareNow(key, file, version, highRes));
    return prepareQueue.current;
  };

  /** Prepares one photo (again, when HD changes) and puts the result in the tray. */
  const prepareNow = async (key: string, file: File, version: number, highRes: boolean) => {
    try {
      const image = await prepareImage(file, { hd: highRes });
      const previewUrl = URL.createObjectURL(image.blob);
      previewUrls.current.add(previewUrl);
      setAttachments((list) => {
        const current = list.find((a) => a.key === key);
        // Removed, or re-prepared since: this result is stale.
        if (!current || current.version !== version) {
          URL.revokeObjectURL(previewUrl);
          previewUrls.current.delete(previewUrl);
          return list;
        }
        dropPreview(current);
        return list.map((a) => (a.key === key ? { key, file, version, state: "ready", image, previewUrl } : a));
      });
    } catch (error) {
      devLog("image prepare failed", error);
      const message = error instanceof ImageValidationError ? error.message : MESSAGES.upload;
      setAttachments((list) =>
        list.map((a) => (a.key === key && a.version === version ? { key, file, version, state: "error", message } : a)),
      );
    }
  };

  const attachFiles = (files: File[]) => {
    const room = MAX_PHOTOS - attachments.length;
    const added = files.slice(0, Math.max(0, room)).map((file) => ({ key: uuid(), file, version: 1, state: "processing" as const }));
    if (!added.length) return;
    setAttachments((list) => [...list, ...added]);
    for (const a of added) void prepare(a.key, a.file, 1, hd);
  };

  const removeAttachment = (key: string) => {
    dropPreview(attachments.find((a) => a.key === key));
    setAttachments((list) => list.filter((a) => a.key !== key));
  };

  // HD on or off: prepare every photo again at the new size.
  const toggleHd = () => {
    const next = !hd;
    setHd(next);
    const redo = attachments.map((a): Attachment => {
      dropPreview(a);
      return { key: a.key, file: a.file, version: a.version + 1, state: "processing" };
    });
    setAttachments(redo);
    for (const a of redo) void prepare(a.key, a.file, a.version, next);
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
    if (readyImages.length > 0) {
      sendImages(
        readyImages.map((a) => a.image),
        trimmed,
        replyTo,
      );
      // Sent photos leave the tray; failed ones stay so you can see why.
      readyImages.forEach(dropPreview);
      setAttachments((list) => list.filter((a) => a.state === "error"));
      setHd(false);
    } else if (!sendText(text, replyTo, style, effect)) {
      return;
    }
    setText("");
    setStyle(null);
    setEffect(null);
    setStylesOpen(false);
    onCancelReply();
    onSent();
    stopTyping();
  };

  // ------------------------------------------------------------ voice messages
  const canRecord = useSyncExternalStore(subscribeNoop, voiceSupported, () => false);
  const [recorder, setRecorder] = useState<Recorder | null>(null);
  const [starting, setStarting] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [recLevel, setRecLevel] = useState(0);
  const [recError, setRecError] = useState<string | null>(null);
  const [recFull, setRecFull] = useState(false);

  const startVoice = async () => {
    setRecError(null);
    setRecFull(false);
    setStarting(true);
    try {
      const rec = await startRecording();
      haptic("press");
      setRecElapsed(0);
      setRecorder(rec);
    } catch (error) {
      setRecError(error instanceof RecorderError ? error.message : "Couldn't start recording.");
    } finally {
      setStarting(false);
    }
  };

  // The timer and level meter, and the 5-minute cap (it stops, you choose).
  useEffect(() => {
    if (!recorder) return;
    const tick = setInterval(() => {
      const elapsed = recorder.elapsedMs();
      setRecElapsed(elapsed);
      setRecLevel(recorder.level());
      if (elapsed >= MAX_VOICE_MS) {
        clearInterval(tick);
        setRecFull(true);
      }
    }, 100);
    return () => clearInterval(tick);
  }, [recorder]);

  // Leaving the chat mid-recording throws it away (and frees the microphone).
  useEffect(() => () => recorder?.cancel(), [recorder]);

  const cancelVoice = () => {
    recorder?.cancel();
    setRecorder(null);
  };

  const sendVoiceNow = async () => {
    if (!recorder) return;
    const rec = recorder;
    setRecorder(null);
    try {
      const recording = await rec.stop();
      if (recording.durationMs < 500) {
        setRecError("Too short. Tap the mic and talk, then send.");
        return;
      }
      sendVoice(recording, replyTo);
      onCancelReply();
      onSent();
    } catch (error) {
      setRecError(error instanceof RecorderError ? error.message : "Couldn't save the recording.");
    }
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
    const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (files.length) {
      e.preventDefault();
      attachFiles(files);
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
            <p className="px-4 pt-2 text-meta font-semibold text-muted-strong" id="style-label">Style</p>
            <div className="scroll-area flex gap-2 overflow-x-auto px-4 pt-1 pb-0.5" role="radiogroup" aria-labelledby="style-label">
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
            {/* Send effects, like iMessage's: they play when it arrives. */}
            <p className="px-4 pt-2 text-meta font-semibold text-muted-strong" id="effect-label">Effect</p>
            <div className="scroll-area flex gap-2 overflow-x-auto px-4 pt-1 pb-0.5" role="radiogroup" aria-labelledby="effect-label">
              {EFFECT_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={effect === option.id}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setEffect(option.id)}
                  className={cn(
                    "pill flex min-h-10 shrink-0 items-center border-2 px-3.5 text-small font-semibold transition-colors",
                    effect === option.id ? "border-love bg-love-soft text-foreground" : "border-field-border text-muted-strong hover:text-foreground",
                  )}
                >
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

        {attachments.length > 0 && (
          <motion.div
            key="attachments"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            {/* The tray, like WhatsApp's: what you picked, before it goes. */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3">
              <p className="text-small text-muted-strong" role="status">
                {preparing
                  ? "Preparing…"
                  : `${readyImages.length} ${readyImages.length === 1 ? "photo" : "photos"}${attachments.length > readyImages.length ? " · some couldn't be used" : ""}`}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleHd}
                  aria-pressed={hd}
                  className={cn(
                    "pill flex min-h-9 items-center border-2 px-3 text-meta font-bold transition-colors",
                    hd ? "border-love bg-love-soft text-foreground" : "border-field-border text-muted-strong hover:text-foreground",
                  )}
                  title={hd ? "Full size" : "Smaller and quicker to send"}
                >
                  HD
                  <span className="sr-only">{hd ? ": sending full size" : ": off, sending smaller photos"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    attachments.forEach(dropPreview);
                    setAttachments([]);
                    setHd(false);
                  }}
                  className="-mr-2.5 flex size-11 items-center justify-center rounded-full text-muted-strong hover:bg-panel-strong hover:text-foreground"
                  aria-label="Remove all photos"
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            </div>
            <ul className="scroll-area flex gap-2 overflow-x-auto px-4 pt-2 pb-1" aria-label="Photos to send">
              {attachments.map((a, i) => (
                <li key={a.key} className="relative size-16 shrink-0">
                  {a.state === "ready" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                    <img src={a.previewUrl} alt={`Photo ${i + 1}`} className="size-full rounded-xl object-cover" />
                  ) : a.state === "processing" ? (
                    <span className="skeleton block size-full rounded-xl" aria-label={`Photo ${i + 1}, preparing`} />
                  ) : (
                    <span
                      className="flex size-full items-center justify-center rounded-xl border-2 border-danger p-1 text-center text-[0.6875rem] leading-tight text-danger"
                      title={a.message}
                    >
                      Can&apos;t use
                      <span className="sr-only">: {a.message}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.key)}
                    className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-foreground text-background shadow-[var(--shadow-raised)]"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <CloseIcon size={12} />
                  </button>
                </li>
              ))}
              {attachments.length < MAX_PHOTOS && (
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex size-16 items-center justify-center rounded-xl border-2 border-dashed border-field-border text-muted-strong hover:bg-panel-strong hover:text-foreground"
                    aria-label="Add more photos"
                  >
                    <PlusIcon size={22} />
                  </button>
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {recError && (
        <p className="px-4 pt-2 text-small text-danger" role="alert">
          {recError}
        </p>
      )}

      {recorder ? (
        <div className="flex items-center gap-2 px-4 pt-2" role="group" aria-label="Recording a voice message">
          <button
            type="button"
            onClick={cancelVoice}
            className="-ml-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-danger hover:bg-panel-strong"
            aria-label="Delete recording"
          >
            <TrashIcon size={20} />
          </button>
          <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[22px] border-2 border-field-border bg-background px-4">
            <span className={cn("size-2.5 shrink-0 rounded-full bg-danger", !recFull && "animate-pulse")} aria-hidden="true" />
            <span className="font-mono text-small tabular-nums" aria-live="off">
              {formatDuration(recElapsed)}
            </span>
            {/* A live meter: bars that follow your voice. */}
            <span className="flex h-6 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden="true">
              {Array.from({ length: 24 }, (_, i) => (
                <span
                  key={i}
                  className="w-[3px] shrink-0 rounded-full bg-love transition-[height] duration-100"
                  style={{ height: `${Math.max(3, Math.min(24, recLevel * 28 * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + recElapsed / 180)))))}px` }}
                />
              ))}
            </span>
            {recFull && <span className="shrink-0 text-meta text-muted-strong">5 min max</span>}
          </div>
          <button
            type="button"
            onClick={() => void sendVoiceNow()}
            className="flex size-11 shrink-0 items-center justify-center"
            aria-label="Send voice message"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-love text-love-foreground">
              <ArrowUpIcon size={20} strokeWidth={2.6} />
            </span>
          </button>
        </div>
      ) : (
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
          // Several at once: iPhone's picker then shows numbered ticks.
          multiple
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            attachFiles(files);
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
            placeholder={attachments.length ? "Add a caption" : `Message ${partner.display_name}`}
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
                  effect ? "text-love" : style || stylesOpen ? "text-foreground" : "text-muted-strong",
                )}
                aria-label={style || effect ? `Style and effect: ${[STYLE_OPTIONS.find((o) => o.id === style)?.label, EFFECT_OPTIONS.find((o) => o.id === effect)?.label].filter(Boolean).join(", ")}` : "Message style and effect"}
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

        {/* Nothing typed: the mic, like iMessage and WhatsApp. */}
        {canRecord && !editing && !trimmed && attachments.length === 0 ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => void startVoice()}
            disabled={starting}
            className="flex size-11 shrink-0 items-center justify-center"
            aria-label="Record a voice message"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-panel-strong text-foreground">
              <MicIcon size={20} />
            </span>
          </motion.button>
        ) : (
        <motion.button
          type="submit"
          disabled={!canSend}
          whileTap={canSend ? { scale: 0.92 } : undefined}
          // Keep the keyboard open on mobile after tapping send.
          onPointerDown={(e) => e.preventDefault()}
          // A round arrow-up, like iMessage, in a 44px target.
          className="group/send flex size-11 shrink-0 items-center justify-center"
          aria-label={editing ? "Save edit" : "Send message"}
        >
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-full transition-colors",
              canSend ? "bg-love text-love-foreground group-hover/send:bg-love/90" : "bg-panel-strong text-muted",
            )}
          >
            {editing ? <CheckIcon size={18} /> : <ArrowUpIcon size={20} strokeWidth={2.6} />}
          </span>
        </motion.button>
        )}
      </form>
      )}
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
