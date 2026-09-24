"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/icons";
import { useChat } from "@/components/providers/ChatProvider";
import { createClient } from "@/lib/supabase/client";
import { activeStatus, STATUS_PRESETS } from "@/lib/status";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/field";

const MAX_TEXT = 40;

export function StatusPicker({ onClose }: { onClose: () => void }) {
  const { me, updateMe } = useChat();
  const current = activeStatus(me);
  const [emoji, setEmoji] = useState(current?.emoji ?? "");
  const [text, setText] = useState(current?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (next: { emoji: string; text: string } | null) => {
    setSaving(true);
    setError(null);
    const patch = {
      status_emoji: next?.emoji.trim() ? [...next.emoji.trim()].slice(0, 4).join("") : null,
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
    <Dialog onClose={onClose} label="Set your status" className="w-full sm:w-[420px]">
      <div className="rounded-t-[20px] bg-background-raised p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[20px]">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-title font-bold">Your status</h2>
          </div>
          <button type="button" onClick={onClose} className="-mt-1 -mr-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-panel-strong hover:text-foreground" aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Quick statuses">
          {STATUS_PRESETS.map((p) => {
            const active = emoji === p.emoji && text === p.text;
            return (
              <button
                key={p.text}
                type="button"
                onClick={() => {
                  setEmoji(p.emoji);
                  setText(p.text);
                }}
                aria-pressed={active}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-control border px-1 text-small transition-colors",
                  active ? "border-accent bg-accent-soft font-semibold" : "border-transparent bg-panel-strong hover:bg-border",
                )}
              >
                <span className="text-xl leading-none" aria-hidden="true">{p.emoji}</span>
                <span>{p.text}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <label className="sr-only" htmlFor="status-emoji">Emoji</label>
          <input
            id="status-emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={8}
            placeholder="✨"
            className={cn(fieldClass, "w-14 px-2 text-center")}
          />
          <label className="sr-only" htmlFor="status-text">Status text</label>
          <input
            id="status-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
            placeholder="Custom status"
            className={cn(fieldClass, "min-w-0 flex-1")}
          />
        </div>

        {error && <p className="mt-3 text-small text-danger" role="alert">{error}</p>}

        <div className="mt-5 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => save(null)} disabled={saving}>
            Clear
          </Button>
          <Button onClick={() => save({ emoji, text })} disabled={saving || (!emoji.trim() && !text.trim())}>
            {saving ? "Saving…" : "Set status"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
