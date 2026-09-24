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
import { toRoman } from "@/lib/roman";
import { daysSince, formatLongDate } from "@/lib/time";
import { friendlyError } from "@/lib/errors";
import { activeStatus } from "@/lib/status";

type Stats = {
  message_count: number;
  image_count: number;
  first_message_at: string | null;
  favorite_emoji: string | null;
};

const SEGMENTS = 16;

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
  const filled = Math.round((progress / 100) * SEGMENTS);

  return (
    <div className="scroll-area h-full overflow-y-auto pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-8 sm:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-display text-xs tracking-[0.3em] text-accent-strong">Confidant file</p>
            <h1 className="text-display text-5xl">Bond</h1>
          </div>
          <Button variant="outline" onClick={() => setEditing(true)} disabled={!bond} aria-label="Edit bond settings">
            <EditIcon size={16} /> Edit
          </Button>
        </div>

        {/* The duo */}
        <motion.section
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.9, 0.1, 1] }}
          className="cut-corners relative overflow-hidden bg-panel px-5 py-7"
          aria-label="The two of you"
        >
          <span className="absolute inset-y-0 left-1/2 w-24 -translate-x-1/2 -skew-x-[18deg] bg-accent" aria-hidden="true" />
          <span className="halftone absolute inset-y-0 left-1/2 w-40 -translate-x-1/2 -skew-x-[18deg] opacity-30" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-2">
            <DuoMember name={me.display_name} profile={me} />
            <span className="text-display text-6xl text-accent-foreground drop-shadow-[3px_3px_0_#000]" aria-hidden="true">
              X
            </span>
            <DuoMember name={partner.display_name} profile={partner} />
          </div>
        </motion.section>

        {/* Level */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.06, ease: [0.2, 0.9, 0.1, 1] }}
          className="flex flex-col items-center text-center"
          aria-label="Bond level"
        >
          <p className="text-display text-sm tracking-[0.4em] text-muted-strong">Bond level</p>
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
            className="flex w-full max-w-md gap-1"
            role="progressbar"
            aria-label="Progress to next level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <motion.span
                key={i}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.18, delay: 0.1 + i * 0.02 }}
                className={i < filled ? "h-4 flex-1 -skew-x-12 bg-accent" : "h-4 flex-1 -skew-x-12 bg-panel-strong"}
              />
            ))}
          </div>
          <p className="text-display mt-5 bg-foreground px-4 py-1.5 text-xl tracking-wider text-background -skew-x-6">
            {bond?.title ?? "Partners in Crime"}
          </p>
          <p className="text-display mt-3 text-sm tracking-[0.2em] text-muted">
            {me.display_name} <span className="font-sans">×</span> {partner.display_name}
          </p>
        </motion.section>

        {/* Stats */}
        <section aria-label="Statistics">
          <h2 className="text-display mb-3 text-xs tracking-[0.3em] text-muted">Record</h2>
          {statsError ? (
            <div className="flex items-center justify-between gap-3 bg-panel p-4 text-sm" role="alert">
              <span className="text-muted-strong">{statsError}</span>
              <Button variant="outline" onClick={() => void loadStats()}>
                Retry
              </Button>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3">
              <Stat label="Messages exchanged" value={stats ? stats.message_count.toLocaleString() : null} />
              <Stat
                label="Days together"
                value={bond?.together_since ? daysSince(bond.together_since).toLocaleString() : stats ? "—" : null}
                hint={bond?.together_since ? `since ${formatLongDate(bond.together_since)}` : "Set a date in Edit"}
              />
              <Stat label="Favorite emoji" value={stats ? stats.favorite_emoji ?? "—" : null} large />
              <Stat label="Photos shared" value={stats ? stats.image_count.toLocaleString() : null} />
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

function DuoMember({ name, profile }: { name: string; profile: Parameters<typeof Avatar>[0]["profile"] }) {
  const status = activeStatus(profile);
  return (
    <div className="flex w-[38%] flex-col items-center gap-2 text-center">
      <Avatar profile={profile} size="xl" />
      <p className="text-display w-full truncate text-2xl">{name}</p>
      {status && (
        <p className="w-full truncate text-xs text-muted-strong">
          <span aria-hidden="true">{status.emoji}</span> {status.text}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  large,
  wide,
}: {
  label: string;
  value: string | null;
  hint?: string;
  large?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`cut-corners-sm bg-panel p-4 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-display text-[11px] tracking-[0.2em] text-muted">{label}</dt>
      <dd className={`text-display mt-1 ${large ? "text-4xl" : "text-3xl"}`}>
        {value === null ? <Skeleton className="h-8 w-20" /> : value}
      </dd>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
