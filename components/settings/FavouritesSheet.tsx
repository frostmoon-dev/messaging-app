"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { CloseIcon, StarIcon } from "@/components/ui/icons";
import { useChat } from "@/components/providers/ChatProvider";
import { snippetText } from "@/components/chat/ReplyQuote";
import { createClient } from "@/lib/supabase/client";
import { fetchStarred } from "@/lib/messages/api";
import { friendlyError } from "@/lib/errors";
import { formatLongDate, formatTime } from "@/lib/time";
import type { MessageRow } from "@/types/app";

/** Your favourites, newest first. Tap one to open the chat at that message. */
export function FavouritesSheet({ onClose, onPick }: { onClose: () => void; onPick?: (id: string) => void }) {
  const router = useRouter();
  const { me, partner } = useChat();
  const [items, setItems] = useState<MessageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStarred(createClient())
      .then((rows) => !cancelled && setItems(rows))
      .catch((err) => !cancelled && setError(friendlyError(err, "load")));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Dialog onClose={onClose} label="Favourites" className="w-full sm:w-[480px]">
      <div className="flex max-h-[80dvh] flex-col bg-background-raised pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-title font-bold">Favourites</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2.5 flex size-11 items-center justify-center rounded-full text-muted-strong hover:bg-panel-strong hover:text-foreground"
            aria-label="Close"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {error && (
            <p className="px-2 py-6 text-center text-small text-danger" role="alert">
              {error}
            </p>
          )}
          {items === null && !error && (
            <div className="flex flex-col gap-2 px-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="skeleton block h-14 rounded-2xl" />
              ))}
            </div>
          )}
          {items?.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <StarIcon size={28} className="text-muted" />
              <p className="text-small text-muted-strong">
                No favourites yet. Long-press a message and choose &ldquo;Add to favourites&rdquo;.
              </p>
            </div>
          )}
          {items && items.length > 0 && (
            <ul className="flex flex-col">
              {items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      // In the chat: jump straight there. Elsewhere: open the chat at it.
                      if (onPick) onPick(m.id);
                      else router.push(`/chat?m=${m.id}`);
                    }}
                    className="flex w-full flex-col gap-0.5 rounded-2xl px-3 py-2.5 text-left hover:bg-panel-strong"
                  >
                    <span className="flex items-baseline justify-between gap-3 text-meta text-muted">
                      <span className="font-bold text-muted-strong">{m.sender_id === me.id ? "You" : partner.display_name}</span>
                      <span className="font-mono">
                        {formatLongDate(m.created_at)} · {formatTime(m.created_at)}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-body break-words">{snippetText(m)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
