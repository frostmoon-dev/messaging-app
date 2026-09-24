"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";
import { useChat } from "@/components/providers/ChatProvider";
import { useSignedUrl } from "@/lib/hooks/useSignedUrl";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { formatLongDate } from "@/lib/time";
import type { MemoryRow } from "@/types/app";

export function MemoryViewer({
  memory,
  onClose,
  onDeleted,
}: {
  memory: MemoryRow;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const { me, partner } = useChat();
  const { url } = useSignedUrl("memories", memory.image_path);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = memory.created_by === me.id;

  const remove = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("memories").delete().eq("id", memory.id);
    if (err) {
      setBusy(false);
      setError(friendlyError(err, "save"));
      return;
    }
    // Best effort: the row is gone either way.
    await supabase.storage.from("memories").remove([memory.image_path]);
    onDeleted(memory.id);
  };

  return (
    <Dialog onClose={onClose} label={memory.title} variant="fullscreen" className="w-full max-w-lg px-4">
      <article className="relative bg-incoming p-3 pb-5 text-incoming-foreground shadow-[6px_6px_0_var(--accent)]">
        <button
          type="button"
          onClick={onClose}
          className="shape-tag absolute -top-3 -right-3 z-10 flex size-11 items-center justify-center bg-accent text-accent-foreground"
          aria-label="Close"
          autoFocus
        >
          <CloseIcon size={20} />
        </button>
        <div className="flex max-h-[60dvh] items-center justify-center overflow-hidden bg-black/10">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket
            <img src={url} alt={memory.title} className="max-h-[60dvh] w-full object-contain" />
          ) : (
            <div className="skeleton aspect-square w-full" />
          )}
        </div>
        <h2 className="text-display mt-3 text-3xl">{memory.title}</h2>
        <p className="text-xs tracking-wide opacity-60">
          {formatLongDate(memory.memory_date)} · saved by {mine ? "you" : partner.display_name}
        </p>
        {memory.caption && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap">{memory.caption}</p>}

        {error && <p className="mt-3 text-sm text-accent" role="alert">{error}</p>}

        {mine && (
          <div className="mt-4 flex justify-end">
            {confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm">Delete this memory?</span>
                <Button variant="ghost" slanted={false} className="text-incoming-foreground" onClick={() => setConfirming(false)}>
                  Keep
                </Button>
                <Button onClick={remove} disabled={busy}>{busy ? "Deleting…" : "Delete"}</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex min-h-10 items-center gap-1.5 px-2 text-sm opacity-70 hover:opacity-100"
              >
                <TrashIcon size={16} /> Delete
              </button>
            )}
          </div>
        )}
      </article>
    </Dialog>
  );
}
