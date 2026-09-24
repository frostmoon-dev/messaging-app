"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useChat } from "@/components/providers/ChatProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EditIcon } from "@/components/ui/icons";
import { UiMark } from "@/components/ui/UiMark";
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
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-8 sm:px-8">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-display flex items-center gap-3 text-5xl">
            <UiMark name="arcana" className="size-11 bg-accent" />
            Bond
          </h1>
          <Button variant="outline" onClick={() => setEditing(true)} disabled={!bond} aria-label="Edit bond settings">
            <EditIcon size={16} /> Edit
          </Button>
        </div>

        {/* The duo */}
        <section className="cut-corners relative overflow-hidden bg-panel px-5 py-7" aria-label="The two of you">
          <span className="absolute inset-y-0 left-1/2 w-24 -translate-x-1/2 -skew-x-[18deg] bg-accent" aria-hidden="true" />
          <span className="halftone absolute inset-y-0 left-1/2 w-40 -translate-x-1/2 -skew-x-[18deg] opacity-30" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-2">
            <DuoMember name={me.display_name} profile={me} />
            <span className="text-display text-6xl text-accent-foreground drop-shadow-[3px_3px_0_#000]" aria-hidden="true">
              X
            </span>
            <DuoMember name={partner.display_name} profile={partner} />
          </div>
        </section>

        {/* Level */}
        <section className="relative flex flex-col items-center text-center" aria-label="Bond level">
          <UiMark name="arcana" className="absolute top-2 left-1/2 size-56 -translate-x-1/2 bg-accent-deep opacity-60" />
          <p className="text-display relative text-sm tracking-[0.4em] text-muted-strong">Bond level</p>
          <p className="text-display relative my-3 inline-flex items-end gap-3 leading-none" aria-label={`Level ${level}`}>
            <span className="relative inline-block min-w-[1.1em] px-[0.12em] text-center text-[104px] sm:text-[132px]" aria-hidden="true">
              <span className="absolute inset-x-0 top-[52%] h-[32%] -skew-x-12 bg-accent" />
              <span className="relative">{toRoman(level)}</span>
            </span>
            <span className="mb-3 text-lg tracking-[0.2em] text-muted-strong" aria-hidden="true">
              Lv.{level}
            </span>
          </p>
          <div
            className="relative flex w-full max-w-md gap-1"
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
          <p className="text-display relative mt-5 bg-foreground px-4 py-1.5 text-xl tracking-wider text-background -skew-x-6">
            {bond?.title ?? "Partners in Crime"}
          </p>
          <p className="text-display relative mt-3 text-sm tracking-[0.2em] text-muted-strong">
            {me.display_name} <span className="font-sans">×</span> {partner.display_name}
          </p>
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
                value={bond?.together_since ? daysSince(bond.together_since).toLocaleString() : stats ? "Not set" : null}
                hint={bond?.together_since ? `since ${formatLongDate(bond.together_since)}` : "Set a date in Edit"}
              />
              <Stat label="Favorite emoji" value={stats ? stats.favorite_emoji ?? "None yet" : null} large />
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
