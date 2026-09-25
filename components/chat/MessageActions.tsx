"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CopyIcon, EditIcon, PinIcon, PlusIcon, ReplyIcon, StarIcon, TrashIcon } from "@/components/ui/icons";
import { EmojiPanel, rememberEmoji } from "./EmojiPanel";
import { haptic } from "@/lib/haptics";
import { useChat } from "@/components/providers/ChatProvider";
import { snippetText } from "./ReplyQuote";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/app";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🥺", "🔥", "👍"];
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * What you can do with one message: react, reply, copy its text, edit (your
 * own text, for 15 minutes) and delete. Deleting asks once, in the same sheet.
 */
export function MessageActions({
  message,
  onReply,
  onEdit,
  onClose,
}: {
  message: ChatMessage;
  onReply: (id: string) => void;
  onEdit: (id: string) => void;
  onClose: () => void;
}) {
  const { me, deleteMessage, hideMessage, pinned, setPinned, starred, toggleStar, partner, reactions, react } = useChat();
  const myReaction = reactions[message.id]?.[me.id] ?? null;
  const [moreEmoji, setMoreEmoji] = useState(false);
  // Read once when the sheet opens: can this still be edited?
  const [openedAt] = useState(() => Date.now());
  const editable =
    message.sender_id === me.id &&
    message.message_type === "text" &&
    !message.deleted_at &&
    openedAt - Date.parse(message.created_at) < EDIT_WINDOW_MS;

  const pickReaction = (emoji: string) => {
    const next = myReaction === emoji ? null : emoji;
    if (next) rememberEmoji(next);
    haptic(next === "❤️" ? "heart" : "press");
    void run(() => react(message.id, next));
  };
  const isPinned = pinned.some((p) => p.id === message.id);
  const isStarred = starred.has(message.id);

  // Pin and star close the sheet straight away; if the server says no, say so here instead.
  const run = async (task: () => Promise<void>) => {
    setError(null);
    try {
      await task();
      onClose();
    } catch (err) {
      setError(friendlyError(err, "save"));
    }
  };
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const deleted = Boolean(message.deleted_at);
  // Once deleted for everyone, only "Delete for me" is left (removes the marker).
  const mine = message.sender_id === me.id && !deleted;
  const text = message.message_type === "text" || message.message_type === "image" ? message.content : null;

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(onClose, 600);
    } catch {
      setError("Couldn't copy. Select the text instead.");
    }
  };

  const remove = async (mode: "everyone" | "me") => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "everyone") await deleteMessage(message.id);
      else await hideMessage(message.id);
      onClose();
    } catch (err) {
      setBusy(false);
      setError(friendlyError(err, "save"));
    }
  };

  return (
    <Dialog onClose={busy ? () => {} : onClose} label="Message options" className="w-full sm:w-[400px]">
      <div className="bg-background-raised px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* Which message this is about, in one line. */}
        <p className="mb-3 truncate px-2 text-small text-muted-strong">{snippetText(message) || "Message"}</p>

        {confirming ? (
          <div className="px-2 pb-1">
            <h2 className="text-title font-bold">Delete this message?</h2>
            <p className="mt-1 text-small text-muted-strong">
              {mine
                ? `"For everyone" removes it from both phones and leaves "Message deleted". "For me" only hides it on your side. Neither can be undone.`
                : `It disappears from your side only. ${partner.display_name} still has it. This can't be undone.`}
            </p>
            {error && (
              <p className="mt-3 text-small text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              {mine && (
                <button
                  type="button"
                  onClick={() => void remove("everyone")}
                  disabled={busy}
                  className="pill min-h-12 bg-danger px-5 font-bold text-background shadow-[var(--shadow-raised)] disabled:opacity-80"
                >
                  Delete for everyone
                </button>
              )}
              <button
                type="button"
                onClick={() => void remove("me")}
                disabled={busy}
                className={
                  mine
                    ? "pill min-h-12 border-2 border-danger px-5 font-bold text-danger disabled:opacity-80"
                    : "pill min-h-12 bg-danger px-5 font-bold text-background shadow-[var(--shadow-raised)] disabled:opacity-80"
                }
              >
                Delete for me
              </button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                {busy ? "Deleting…" : "Keep it"}
              </Button>
            </div>
          </div>
        ) : moreEmoji ? (
          <div className="flex h-[min(24rem,60dvh)] flex-col">
            <EmojiPanel onPick={pickReaction} className="flex-1" />
            <Button variant="ghost" onClick={() => setMoreEmoji(false)} className="mt-1">
              Back
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col">
            {!deleted && (
              <li className="mb-2 flex items-center justify-between gap-1 px-1" role="group" aria-label="React">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => pickReaction(emoji)}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-full text-[1.625rem] leading-none transition-transform active:scale-90",
                      myReaction === emoji ? "bg-accent-soft shadow-[inset_0_0_0_2px_var(--accent)]" : "hover:bg-panel-strong",
                    )}
                    aria-label={myReaction === emoji ? `Remove ${emoji} reaction` : `React ${emoji}`}
                    aria-pressed={myReaction === emoji}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMoreEmoji(true)}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full text-muted-strong hover:bg-panel-strong hover:text-foreground",
                    myReaction && !QUICK_REACTIONS.includes(myReaction) && "bg-accent-soft text-[1.625rem] shadow-[inset_0_0_0_2px_var(--accent)]",
                  )}
                  aria-label={myReaction && !QUICK_REACTIONS.includes(myReaction) ? `Your reaction ${myReaction}. More emoji` : "More emoji"}
                >
                  {myReaction && !QUICK_REACTIONS.includes(myReaction) ? myReaction : <PlusIcon size={20} />}
                </button>
              </li>
            )}
            {!deleted && (
              <>
                <Action
                  icon={<ReplyIcon size={20} />}
                  label="Reply"
                  onClick={() => {
                    onReply(message.id);
                    onClose();
                  }}
                />
                {editable && (
                  <Action
                    icon={<EditIcon size={20} />}
                    label="Edit"
                    onClick={() => {
                      onEdit(message.id);
                      onClose();
                    }}
                  />
                )}
                {text && <Action icon={<CopyIcon size={20} />} label={copied ? "Copied" : "Copy text"} onClick={() => void copy()} />}
                <Action
                  icon={<PinIcon size={20} />}
                  label={isPinned ? "Unpin" : "Pin for both of you"}
                  onClick={() => void run(() => setPinned(message.id, !isPinned))}
                />
                <Action
                  icon={<StarIcon size={20} fill={isStarred ? "currentColor" : "none"} />}
                  label={isStarred ? "Remove from favourites" : "Add to favourites"}
                  onClick={() => void run(() => toggleStar(message.id))}
                />
              </>
            )}
            <Action icon={<TrashIcon size={20} />} label={deleted ? "Delete for me" : "Delete…"} danger onClick={() => setConfirming(true)} />
            {error && (
              <li className="px-3 pt-2 text-small text-danger" role="alert">
                {error}
              </li>
            )}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

function Action({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-body font-semibold transition-colors hover:bg-panel-strong",
          danger ? "text-danger" : "text-foreground",
        )}
      >
        {icon}
        {label}
      </button>
    </li>
  );
}
