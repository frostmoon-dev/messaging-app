"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/icons";
import { StatusIcon } from "@/components/ui/StatusIcon";
import { useChat } from "@/components/providers/ChatProvider";
import { createClient } from "@/lib/supabase/client";
import { activeStatus, STATUS_PRESETS, type StatusIcon as StatusIconId } from "@/lib/status";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { fieldClass, labelClass } from "@/components/ui/field";

const MAX_TEXT = 40;

/**
 * Pick one of seven statuses. The icon is the choice; the text can be
 * changed to say more ("Studying" → "Exams until Friday").
 */
export function StatusPicker({ onClose }: { onClose: () => void }) {
  const { me, updateMe } = useChat();
  const current = activeStatus(me);
  const [icon, setIcon] = useState<StatusIconId | null>(current?.icon ?? null);
  const [text, setText] = useState(current?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (next: StatusIconId) => {
    const preset = STATUS_PRESETS.find((p) => p.icon === next);
    const wasPresetText = STATUS_PRESETS.some((p) => p.text === text) || !text.trim();
    setIcon(next);
    // Replace the label only if the user hasn't written their own.
    if (preset && wasPresetText) setText(preset.text);
  };

  const save = async (next: { icon: StatusIconId | null; text: string } | null) => {
    setSaving(true);
    setError(null);
    const patch = {
      status_emoji: next?.icon ?? null,
      status_text: next?.text.trim() ? next.text.trim().slice(0, MAX_TEXT) : null,
      status_updated_at: next ? new Date().toISOString() : null,
    };
    const { error: err } = await createClient().from("profiles").update(patch).eq("id", me.id);
    setSaving(false);
    if (err) {
      setError(friendlyError(err, "save"));
      return;
    }
    updateMe(patch);
    onClose();
  };

  return (
    <Dialog onClose={onClose} label="Set your status" className="w-full sm:w-[440px]">
      <div className="border-t-4 border-accent bg-background-raised p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-title font-bold">Your status</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 -mr-2 flex size-11 items-center justify-center text-muted-strong hover:bg-panel-strong hover:text-foreground"
            aria-label="Close"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Status">
          {STATUS_PRESETS.map((p) => {
            const active = icon === p.icon;
            return (
              <button
                key={p.icon}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => choose(p.icon)}
                className={cn(
                  "flex min-h-20 flex-col items-center justify-center gap-1.5 px-1 text-small transition-colors",
                  active ? "p5-panel bg-accent font-bold text-accent-foreground" : "p5-panel bg-panel-strong hover:bg-border",
                )}
              >
                <StatusIcon icon={p.icon} className={cn("size-8", active && "bg-accent-foreground")} />
                <span className="text-center leading-tight">{p.text}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <label htmlFor="status-text" className={labelClass}>
            Say more (optional)
          </label>
          <input
            id="status-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
            placeholder="Exams until Friday"
            className={fieldClass}
          />
        </div>

        {error && <p className="mt-3 text-small text-danger" role="alert">{error}</p>}

        <div className="mt-5 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => save(null)} disabled={saving || !current}>
            Clear status
          </Button>
          <Button onClick={() => save({ icon, text })} disabled={saving || !icon}>
            {saving ? "Saving…" : "Set status"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
