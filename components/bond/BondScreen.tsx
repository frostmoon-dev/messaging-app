"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EditIcon } from "@/components/ui/icons";
import { BondEditor } from "./BondEditor";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { daysSince, formatLongDate } from "@/lib/time";
import { friendlyError } from "@/lib/errors";

type Stats = {
  message_count: number;
  image_count: number;
  first_message_at: string | null;
  favorite_emoji: string | null;
};

export function BondScreen() {
  const { me, partner, bond, conversationId } = useChat();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsError(null);
    const { data, error } = await createClient().rpc("conversation_stats", { conv: conversationId }).single();
    if (error) setStatsError(friendlyError(error, "load"));
    else setStats(data);
  }, [conversationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    void loadStats();
  }, [loadStats]);

  const level = bond?.level ?? 1;
  const progress = bond?.progress ?? 0;
  const days = bond?.together_since ? daysSince(bond.together_since) : null;

  return (
    <div className="scroll-area h-full overflow-y-auto pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <PageHeader
          title="Bond"
          description="Set by the two of you, by hand. The app never scores it."
          action={
            <Button variant="secondary" onClick={() => setEditing(true)} disabled={!bond}>
              <EditIcon size={18} /> Edit
            </Button>
          }
        />

        <section className="rounded-card border border-border bg-panel p-5" aria-label="Bond level">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3" aria-hidden="true">
              <Avatar profile={me} size="lg" className="rounded-full ring-4 ring-panel" />
              <Avatar profile={partner} size="lg" className="rounded-full ring-4 ring-panel" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-title font-bold">{bond?.title ?? "Partners in Crime"}</p>
              <p className="truncate text-small text-muted">
                {me.display_name} and {partner.display_name}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-baseline justify-between gap-3">
            <p className="text-small text-muted-strong">
              Level <span className="font-mono text-heading font-bold text-foreground">{level}</span>
            </p>
            <p className="text-small text-muted">
              <span className="font-mono">{progress}%</span> to level {level + 1}
            </p>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-panel-strong"
            role="progressbar"
            aria-label={`Progress to level ${level + 1}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
        </section>

        <section aria-labelledby="bond-record">
          <h2 id="bond-record" className="mb-3 text-title font-bold">
            Your record
          </h2>
          {statsError ? (
            <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-panel p-4" role="alert">
              <span className="text-small text-muted-strong">{statsError}</span>
              <Button variant="secondary" onClick={() => void loadStats()}>
                Try again
              </Button>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              <Stat label="Messages" value={stats ? stats.message_count.toLocaleString() : null} />
              <Stat
                label="Days together"
                value={days !== null ? days.toLocaleString() : stats ? "Not set" : null}
                hint={bond?.together_since ? `Since ${formatLongDate(bond.together_since)}` : "Add a date with Edit"}
              />
              <Stat label="Photos shared" value={stats ? stats.image_count.toLocaleString() : null} />
              <Stat label="Most used emoji" value={stats ? stats.favorite_emoji ?? "None yet" : null} />
              <Stat
                label="First message"
                value={stats ? (stats.first_message_at ? formatLongDate(stats.first_message_at) : "Not yet") : null}
                wide
              />
            </dl>
          )}
        </section>
      </div>

      {editing && bond && <BondEditor bond={bond} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Stat({ label, value, hint, wide }: { label: string; value: string | null; hint?: string; wide?: boolean }) {
  return (
    <div className={cn("rounded-card border border-border bg-panel p-4", wide && "col-span-2")}>
      <dt className="text-small text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-heading font-bold">
        {value === null ? <Skeleton className="h-8 w-20" /> : value}
      </dd>
      {hint && <p className="mt-1 text-meta text-muted">{hint}</p>}
    </div>
  );
}
