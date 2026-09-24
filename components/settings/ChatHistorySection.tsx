"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { StarIcon, TrashIcon } from "@/components/ui/icons";
import { FavouritesSheet } from "./FavouritesSheet";
import { useChat } from "@/components/providers/ChatProvider";
import { friendlyError } from "@/lib/errors";
import { Panel } from "./Panel";

/** Clears the chat on your side only. Asks first, and says exactly who it affects. */
export function ChatHistorySection() {
  const { partner, clearHistory } = useChat();
  const [confirming, setConfirming] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const clear = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await clearHistory();
      setConfirming(false);
      setMessage({ tone: "ok", text: "Chat cleared for you." });
    } catch (err) {
      setMessage({ tone: "error", text: friendlyError(err, "save") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Chat history">
      <p className="text-small text-muted-strong">
        Long-press (or right-click) a message in the chat to pin it, add it to your favourites, or delete it for both of you. Clearing removes
        every message up to now from your side only; {partner.display_name} keeps theirs.
      </p>
      <div className="mt-4 -ml-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => setShowFavourites(true)}>
          <StarIcon size={18} /> Favourites
        </Button>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          <TrashIcon size={18} /> Clear chat
        </Button>
      </div>
      {showFavourites && <FavouritesSheet onClose={() => setShowFavourites(false)} />}
      {message && !confirming && (
        <p className={message.tone === "error" ? "mt-2 text-small text-danger" : "mt-2 text-small text-muted-strong"} role="status">
          {message.text}
        </p>
      )}

      {confirming && (
        <Dialog onClose={busy ? () => {} : () => setConfirming(false)} label="Clear chat?" className="w-full sm:w-[420px]">
          <div className="bg-background-raised p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h2 className="text-title font-bold">Clear the chat for you?</h2>
            <p className="mt-2 text-body text-muted-strong">
              All messages up to now disappear from your side. {partner.display_name} still sees them. This can&apos;t be
              undone.
            </p>
            {message?.tone === "error" && (
              <p className="mt-3 text-small text-danger" role="alert">
                {message.text}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => void clear()}
                disabled={busy}
                className="pill min-h-11 flex-1 bg-danger px-5 font-bold text-background shadow-[var(--shadow-raised)] disabled:opacity-80"
              >
                {busy ? "Clearing…" : "Clear chat"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </Panel>
  );
}
