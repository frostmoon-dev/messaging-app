"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/icons";
import { useChat } from "@/components/providers/ChatProvider";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { todayDateOnly } from "@/lib/time";
import type { BondRow } from "@/types/app";

const inputClass = "w-full border border-border bg-panel px-3 py-2.5 text-[16px] outline-none focus:border-accent";
const labelClass = "text-display mb-1.5 block text-xs tracking-[0.2em] text-muted-strong";

/** Everything here is set by hand. The app never judges the relationship. */
export function BondEditor({ bond, onClose }: { bond: BondRow; onClose: () => void }) {
  const { setBond } = useChat();
  const [level, setLevel] = useState(String(bond.level));
  const [progress, setProgress] = useState(bond.progress);
  const [title, setTitle] = useState(bond.title);
  const [since, setSince] = useState(bond.together_since ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const levelNumber = Number(level);
  const valid =
    Number.isInteger(levelNumber) && levelNumber >= 1 && levelNumber <= 99 && title.trim().length > 0 && title.length <= 60;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    const patch = {
      level: levelNumber,
      progress,
      title: title.trim(),
      together_since: since || null,
    };
    const { data, error: err } = await createClient()
      .from("bond")
      .update(patch)
      .eq("conversation_id", bond.conversation_id)
      .select("*")
      .single();
    setSaving(false);
    if (err) {
      setError(friendlyError(err, "save"));
      return;
    }
    setBond(data);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="Edit bond" className="w-full sm:w-[440px]">
      <form onSubmit={save} className="cut-corners bg-background-raised p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mb-5 flex items-start justify-between">
          <h2 className="text-display text-3xl">Edit bond</h2>
          <button type="button" onClick={onClose} className="p-2 text-muted hover:text-foreground" aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="bond-level" className={labelClass}>Level (1–99)</label>
            <input
              id="bond-level"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="bond-since" className={labelClass}>Together since</label>
            <input
              id="bond-since"
              type="date"
              max={todayDateOnly()}
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="bond-progress" className={labelClass}>
            Progress to next level · {progress}%
          </label>
          <input
            id="bond-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="bond-title" className={labelClass}>Title</label>
          <input
            id="bond-title"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Partners in Crime"
          />
        </div>

        {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" slanted={false} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
