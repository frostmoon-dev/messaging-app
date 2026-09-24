"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EditIcon } from "@/components/ui/icons";
import { UiMark } from "@/components/ui/UiMark";
import { PageHeader } from "@/components/ui/PageHeader";
import { BondEditor } from "./BondEditor";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { daysSince, formatLongDate } from "@/lib/time";
import { friendlyError } from "@/lib/errors";
import type { Profile } from "@/types/app";

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

  const rank = bond?.level ?? 1;
  const progress = bond?.progress ?? 0;
  const ready = progress >= 100;

  return (
    <div className="scroll-area h-full overflow-y-auto pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-8 sm:px-8">
        <PageHeader
          title="Bond"
          action={
            <Button variant="secondary" onClick={() => setEditing(true)} disabled={!bond}>
              <EditIcon size={16} /> Edit
            </Button>
          }
        />

        {/* Social Link card: the two of you, the arcana, the rank. */}
        <section className="rounded-card bg-panel p-5 sm:p-6" aria-labelledby="bond-rank">
          <div className="flex items-center justify-between gap-3">
            <Member profile={me} label="You" />
            <UiMark name="arcana" className="size-16 bg-accent sm:size-20" />
            <Member profile={partner} label={partner.display_name} />
          </div>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 id="bond-rank" className="text-small text-muted-strong">
                Rank
              </h2>
              <p className="font-mono text-[3.5rem] leading-none font-bold">{rank}</p>
            </div>
            <p className="min-w-0 text-right text-title font-bold">{bond?.title ?? "Partners in Crime"}</p>
          </div>

          <div
            className="mt-4 h-3 overflow-hidden rounded-full bg-panel-strong"
            role="progressbar"
            aria-label={`Progress to rank ${rank + 1}`}
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
          <p className="mt-2 flex items-center gap-2 text-small text-muted-strong">
            {ready ? (
              <>
                <UiMark name="rankup" className="h-6 w-9 bg-accent" />
                <span className="font-semibold text-foreground">Ready for rank {rank + 1}.</span> Update it in Edit.
              </>
            ) : (
              <>
                <span className="font-mono">{progress}%</span> to rank {rank + 1}
              </>
            )}
          </p>
        </section>

        <section aria-labelledby="bond-record">
          <h2 id="bond-record" className="mb-3 text-title font-bold">
            Your record
          </h2>
          {statsError ? (
            <div className="flex items-center justify-between gap-3 rounded-card bg-panel p-4" role="alert">
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
                value={bond?.together_since ? daysSince(bond.together_since).toLocaleString() : stats ? "Not set" : null}
                hint={bond?.together_since ? `Since ${formatLongDate(bond.together_since)}` : "Set the date in Edit"}
              />
              <Stat label="Photos shared" value={stats ? stats.image_count.toLocaleString() : null} />
              <Stat label="Most used emoji" value={stats ? (stats.favorite_emoji ?? "None yet") : null} />
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

function Member({ profile, label }: { profile: Profile; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <Avatar profile={profile} size="lg" />
      <span className="max-w-full truncate text-small font-semibold">{label}</span>
    </div>
  );
}

function Stat({ label, value, hint, wide }: { label: string; value: string | null; hint?: string; wide?: boolean }) {
  return (
    <div className={cn("rounded-card bg-panel p-4", wide && "col-span-2")}>
      <dt className="text-small text-muted-strong">{label}</dt>
      <dd className="mt-1 font-mono text-heading font-bold">
        {value === null ? <Skeleton className="h-8 w-20" /> : value}
      </dd>
      {hint && <p className="mt-1 text-meta text-muted">{hint}</p>}
    </div>
  );
}
