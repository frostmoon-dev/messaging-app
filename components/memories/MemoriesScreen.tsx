"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlusIcon } from "@/components/ui/icons";
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
          <div>
            <p className="text-display text-xs tracking-[0.3em] text-accent-strong">Private scrapbook</p>
            <h1 className="text-display text-5xl">Memories</h1>
          </div>
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
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col items-center py-16 text-center"
          >
            <p className="text-display -rotate-3 bg-foreground px-4 py-2 text-3xl text-background">Blank pages</p>
            <p className="mt-5 max-w-xs text-sm text-muted-strong">
              Keep the good ones here — a photo, a title, a date. Only the two of you can see them.
            </p>
            <Button className="mt-6" onClick={() => setAdding(true)}>
              <PlusIcon size={18} /> First memory
            </Button>
          </motion.div>
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
