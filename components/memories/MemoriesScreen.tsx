"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { MemoriesIcon, PlusIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
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
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <PageHeader
          title="Memories"
          description="Photos worth keeping. Only the two of you can see them."
          action={
            memories && memories.length > 0 ? (
              <Button onClick={() => setAdding(true)}>
                <PlusIcon size={18} /> Add
              </Button>
            ) : undefined
          }
        />

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-panel p-4" role="alert">
            <span className="text-small text-muted-strong">{error}</span>
            <Button variant="secondary" onClick={() => void load()}>Try again</Button>
          </div>
        )}

        {memories === null && !error && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Loading memories">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-card" />
            ))}
          </div>
        )}

        {memories?.length === 0 && (
          <div className="flex flex-col items-center rounded-card border border-dashed border-border px-6 py-14 text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden="true">
              <MemoriesIcon size={26} />
            </span>
            <p className="text-title font-bold">No memories yet</p>
            <p className="mt-2 max-w-xs text-small text-muted-strong">
              Save a photo with a title and a date. It stays here for both of you.
            </p>
            <Button className="mt-6" onClick={() => setAdding(true)}>
              <PlusIcon size={18} /> Add the first memory
            </Button>
          </div>
        )}

        {memories && memories.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            <AnimatePresence initial={false}>
              {memories.map((m) => (
                <MemoryCard key={m.id} memory={m} onOpen={() => setViewing(m)} />
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
