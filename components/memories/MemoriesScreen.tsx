"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { MemoriesIcon, PlusIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { MemoryCard, memoryAspect } from "./MemoryCard";
import { MemoryForm } from "./MemoryForm";
import { MemoryViewer } from "./MemoryViewer";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { todayDateOnly } from "@/lib/time";
import { devLog } from "@/lib/utils";
import { yearsAgo } from "@/supabase/functions/send-push/moments";
import type { MemoryRow } from "@/types/app";

const WIDE = "(min-width: 640px)";

function subscribeWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function toColumns(memories: MemoryRow[], count: number) {
  const columns: MemoryRow[][] = Array.from({ length: count }, () => []);
  const heights = Array<number>(count).fill(0);
  for (const m of memories) {
    const i = heights.indexOf(Math.min(...heights));
    columns[i].push(m);
    heights[i] += 1 / memoryAspect(m) + 0.3; // photo + title and date
  }
  return columns;
}

export function MemoriesScreen() {
  const { conversationId } = useChat();
  const columns = useSyncExternalStore(subscribeWidth, () => (window.matchMedia(WIDE).matches ? 3 : 2), () => 2);
  const [memories, setMemories] = useState<MemoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<MemoryRow | null>(null);
  // Memories from this day in earlier years.
  const [onThisDay, setOnThisDay] = useState<MemoryRow[]>([]);
  const today = todayDateOnly();

  useEffect(() => {
    let cancelled = false;
    void createClient()
      .rpc("memories_on_this_day", { conv: conversationId, today })
      .then(({ data, error: err }) => {
        if (err) devLog("on this day failed", err);
        else if (!cancelled) setOnThisDay(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, today]);

  // /memories?m=<id> (from the "On this day" pop-up) opens that memory.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("m");
    if (!id) return;
    window.history.replaceState(null, "", "/memories");
    let cancelled = false;
    void createClient()
      .from("memories")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setViewing(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6">
          <PageHeader
            title="Memories"
            description="Photos worth keeping. Only the two of you can see them."
            action={
              memories?.length ? (
                <Button onClick={() => setAdding(true)}>
                  <PlusIcon size={18} /> Add
                </Button>
              ) : undefined
            }
          />
        </div>

        {error && (
          <div className="card flex items-center justify-between gap-3 bg-panel p-4" role="alert">
            <span className="text-small text-muted-strong">{error}</span>
            <Button variant="secondary" onClick={() => void load()}>Try again</Button>
          </div>
        )}

        {onThisDay.length > 0 && (
          <section className="mb-8" aria-labelledby="on-this-day">
            <h2 id="on-this-day" className="mb-3 text-title font-bold">
              On this day <span className="text-love">♡</span>
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {onThisDay.map((m) => (
                <div key={m.id} className="min-w-0">
                  <p className="mb-1.5 text-small font-semibold text-love">{yearsAgo(m.memory_date, today)}</p>
                  <ul>
                    <MemoryCard memory={m} onOpen={() => setViewing(m)} />
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {memories === null && !error && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Loading memories">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/5] w-full rounded-[18px_5px_18px_18px]" />
            ))}
          </div>
        )}

        {memories?.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="mb-5 flex size-20 items-center justify-center rounded-full bg-panel-strong text-muted-strong">
              <MemoriesIcon size={32} />
            </span>
            <p className="text-title font-bold">No memories yet</p>
            <p className="mt-2 max-w-xs text-body text-muted-strong">Add a photo, a title and a date.</p>
            <Button className="mt-6" onClick={() => setAdding(true)}>
              <PlusIcon size={18} /> Add the first one
            </Button>
          </div>
        )}

        {memories && memories.length > 0 && (
          // Columns of photos at their own shapes. Each photo goes to the
          // shortest column, so the newest stay at the top, left to right.
          <div className="flex items-start gap-4">
            {toColumns(memories, columns).map((column, i) => (
              <ul key={i} className="flex min-w-0 flex-1 flex-col gap-6">
                <AnimatePresence initial={false}>
                  {column.map((m) => (
                    <MemoryCard key={m.id} memory={m} onOpen={() => setViewing(m)} />
                  ))}
                </AnimatePresence>
              </ul>
            ))}
          </div>
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
            setOnThisDay((prev) => prev.filter((m) => m.id !== id));
            setViewing(null);
          }}
        />
      )}
    </div>
  );
}
