"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CopyIcon, PinIcon, ReplyIcon, StarIcon, TrashIcon } from "@/components/ui/icons";
import { useChat } from "@/components/providers/ChatProvider";
import { snippetText } from "./ReplyQuote";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/app";

/**
 * What you can do with one message: reply, copy its text, and (your own
 * only) delete it for both of you. Deleting asks once, in the same sheet.
 */
export function MessageActions({
  message,
  onReply,
  onClose,
}: {
  message: ChatMessage;
  onReply: (id: string) => void;
  onClose: () => void;
}) {
  const { me, deleteMessage, pinned, setPinned, starred, toggleStar } = useChat();
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
  const mine = message.sender_id === me.id;
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

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteMessage(message.id);
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
            <h2 className="text-title font-bold">Delete for both of you?</h2>
            <p className="mt-1 text-small text-muted-strong">
              It disappears from both phones and shows as &ldquo;Message deleted&rdquo;. This can&apos;t be undone.
            </p>
            {error && (
              <p className="mt-3 text-small text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)} disabled={busy}>
                Keep it
              </Button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="pill min-h-11 flex-1 bg-danger px-5 font-bold text-background shadow-[var(--shadow-raised)] disabled:opacity-80"
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col">
            <Action
              icon={<ReplyIcon size={20} />}
              label="Reply"
              onClick={() => {
                onReply(message.id);
                onClose();
              }}
            />
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
            {mine && (
              <Action icon={<TrashIcon size={20} />} label="Delete for everyone" danger onClick={() => setConfirming(true)} />
            )}
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
