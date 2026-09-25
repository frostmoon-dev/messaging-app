"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useChat } from "@/components/providers/ChatProvider";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { REMINDERS, dateKey, timeKey, toStartsAt } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { EventRow } from "@/types/app";

const MAX_TITLE = 80;
const MAX_NOTE = 500;

/** Add a plan, or edit / delete an existing one. Either of you can do both. */
export function EventForm({
  event,
  defaultDate,
  onClose,
  onSaved,
  onDeleted,
}: {
  event: EventRow | null;
  defaultDate: Date;
  onClose: () => void;
  onSaved: (event: EventRow) => void;
  onDeleted: (id: string) => void;
}) {
  const { conversationId } = useChat();
  const start = event ? new Date(event.starts_at) : null;
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(start ? dateKey(start) : dateKey(defaultDate));
  const [time, setTime] = useState(start && !event?.all_day ? timeKey(start) : "19:00");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [remind, setRemind] = useState<number | null>(event ? event.remind_minutes : 60);
  const [note, setNote] = useState(event?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = title.trim().length > 0 && title.length <= MAX_TITLE && note.length <= MAX_NOTE && Boolean(date) && (allDay || Boolean(time));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const fields = {
      title: title.trim(),
      note: note.trim() || null,
      starts_at: toStartsAt(date, time, allDay),
      all_day: allDay,
      remind_minutes: remind,
    };
    const supabase = createClient();
    const result = event
      ? await supabase.from("events").update(fields).eq("id", event.id).select("*").single()
      : await supabase.from("events").insert({ ...fields, conversation_id: conversationId }).select("*").single();
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error, "save"));
      return;
    }
    onSaved(result.data);
  };

  const remove = async () => {
    if (!event) return;
    setBusy(true);
    const { error: err } = await createClient().from("events").delete().eq("id", event.id);
    setBusy(false);
    if (err) {
      setError(friendlyError(err, "save"));
      return;
    }
    onDeleted(event.id);
  };

  return (
    <Dialog onClose={busy ? () => {} : onClose} label={event ? "Edit plan" : "New plan"} className="w-full sm:w-[460px]">
      <form
        onSubmit={save}
        className="max-h-[90dvh] overflow-y-auto bg-background-raised p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mb-5 flex items-start justify-between">
          <h2 className="text-title font-bold">{event ? "Edit plan" : "New plan"}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full -mt-1 -mr-2 flex size-11 items-center justify-center text-muted-strong hover:bg-panel-strong hover:text-foreground"
            aria-label="Close"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <label htmlFor="plan-title" className={labelClass}>
          What
        </label>
        <input
          id="plan-title"
          value={title}
          maxLength={MAX_TITLE}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dinner, movie, call…"
          className={fieldClass}
          required
          autoFocus={!event}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="plan-date" className={labelClass}>
              Date
            </label>
            <input id="plan-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} required />
          </div>
          <div className="min-w-0">
            <label htmlFor="plan-time" className={labelClass}>
              Time
            </label>
            <input
              id="plan-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={cn(fieldClass, allDay && "opacity-50")}
              disabled={allDay}
              required={!allDay}
            />
          </div>
        </div>

        <label className="mt-3 flex min-h-11 items-center gap-3 text-body">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-5 accent-[var(--accent)]" />
          All day
        </label>

        <label htmlFor="plan-remind" className={cn(labelClass, "mt-2")}>
          Remind both of us
        </label>
        <select
          id="plan-remind"
          value={remind === null ? "" : String(remind)}
          onChange={(e) => setRemind(e.target.value === "" ? null : Number(e.target.value))}
          className={fieldClass}
        >
          {REMINDERS.map((r) => (
            <option key={r.label} value={r.minutes === null ? "" : String(r.minutes)}>
              {r.label}
            </option>
          ))}
        </select>
        {allDay && remind !== null && <p className="mt-1 text-small text-muted-strong">All-day reminders arrive at 9:00.</p>}

        <label htmlFor="plan-note" className={cn(labelClass, "mt-4")}>
          Note (optional)
        </label>
        <textarea
          id="plan-note"
          value={note}
          maxLength={MAX_NOTE}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          className={cn(fieldClass, "resize-none")}
        />

        {error && (
          <p className="mt-3 text-small text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {event ? (
            confirmDelete ? (
              <span className="flex items-center gap-2 text-small">
                Delete for both?
                <Button variant="danger" onClick={remove} disabled={busy}>
                  Delete
                </Button>
              </span>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <TrashIcon size={16} /> Delete
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
