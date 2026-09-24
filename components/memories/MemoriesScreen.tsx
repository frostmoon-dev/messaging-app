"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlusIcon } from "@/components/ui/icons";
import { UiMark } from "@/components/ui/UiMark";
import { MemoryCard } from "./MemoryCard";
import { MemoryForm } from "./MemoryForm";
import { MemoryViewer } from "./MemoryViewer";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import type { MemoryRow } from "@/types/app";

export function MemoriesScreen() {
  const { conversationId } = useChat();
  const [memories, setMemories] = useState<MemoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<MemoryRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await createClient()
      .from("memories")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("memory_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (err) setError(friendlyError(err, "load"));
    else setMemories(data);
  }, [conversationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    void load();
  }, [load]);

  return (
    <div className="scroll-area h-full overflow-y-auto pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h1 className="text-display flex items-center gap-3 text-5xl">
            <UiMark name="sakura" className="size-10 bg-accent" />
            Memories
          </h1>
          <Button onClick={() => setAdding(true)} aria-label="Add a memory">
            <PlusIcon size={18} /> Add
          </Button>
        </div>

        {error && (
          <div className="mb-6 flex items-center justify-between gap-3 bg-panel p-4 text-sm" role="alert">
            <span className="text-muted-strong">{error}</span>
            <Button variant="outline" onClick={() => void load()}>Retry</Button>
          </div>
        )}

        {memories === null && !error && (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3" aria-busy="true" aria-label="Loading memories">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/5] w-full" />
            ))}
          </div>
        )}

        {memories?.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="relative mb-4 h-24 w-32" aria-hidden="true">
              <UiMark name="sakura" className="absolute top-0 left-2 size-20 bg-foreground" />
              <UiMark name="sakura" className="absolute right-0 bottom-0 size-10 rotate-[24deg] bg-accent" />
            </span>
            <p className="text-display text-2xl tracking-wide">No memories yet</p>
            <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-muted-strong">
              Keep the good ones here: a photo, a title and a date. Only the two of you can see them.
            </p>
            <Button className="mt-6" onClick={() => setAdding(true)}>
              <PlusIcon size={18} /> Add the first one
            </Button>
          </div>
        )}

        {memories && memories.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-6">
            <AnimatePresence initial={false}>
              {memories.map((m, i) => (
                <MemoryCard key={m.id} memory={m} index={i} onOpen={() => setViewing(m)} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {adding && (
        <MemoryForm
          onClose={() => setAdding(false)}
          onCreated={(m) => {
            setMemories((prev) => [m, ...(prev ?? [])].sort((a, b) => (a.memory_date < b.memory_date ? 1 : -1)));
            setAdding(false);
          }}
        />
      )}
      {viewing && (
        <MemoryViewer
          memory={viewing}
          onClose={() => setViewing(null)}
          onDeleted={(id) => {
            setMemories((prev) => prev?.filter((m) => m.id !== id) ?? null);
            setViewing(null);
          }}
        />
      )}
    </div>
  );
}
