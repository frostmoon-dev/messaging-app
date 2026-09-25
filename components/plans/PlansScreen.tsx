"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useChat, useLiveTable } from "@/components/providers/ChatProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { BellIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@/components/ui/icons";
import { EventForm } from "./EventForm";
import { SharedLists } from "./SharedLists";
import { readPref, writePref } from "@/lib/prefs";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { dateKey, monthGrid, reminderLabel, sameDay } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { EventRow } from "@/types/app";

const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const shortDay = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const subscribeNoop = () => () => {};

export function PlansScreen() {
  // "Today" comes from the viewer's clock, so the calendar renders after hydration.
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  return (
    <div className="scroll-area h-full overflow-y-auto pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">{hydrated ? <Plans /> : <PlansSkeleton />}</div>
    </div>
  );
}

function Plans() {
  const { conversationId, me, partner } = useChat();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EventRow | "new" | null>(null);
  // Calendar or Lists; remembered on this phone. /plans?tab=lists opens Lists.
  const [tab, setTab] = useState<"calendar" | "lists">(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "lists") return "lists";
    return readPref("plans-tab") === "lists" ? "lists" : "calendar";
  });
  const pickTab = (next: "calendar" | "lists") => {
    setTab(next);
    writePref("plans-tab", next === "lists" ? "lists" : null);
  };

  const grid = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  // One query covers the visible month and the "Coming up" list.
  const load = useCallback(async () => {
    setError(null);
    const from = new Date(Math.min(grid[0].getTime(), today.getTime() - 86_400_000));
    const to = new Date(Math.max(grid[41].getTime() + 86_400_000, today.getTime() + 60 * 86_400_000));
    const { data, error: err } = await createClient()
      .from("events")
      .select("*")
      .eq("conversation_id", conversationId)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at")
      .limit(500);
    if (err) setError(friendlyError(err, "load"));
    else setEvents(data);
  }, [conversationId, grid, today]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / month change
    void load();
  }, [load]);

  // Opened from a reminder notification: /plans?event=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("event");
    if (!id || !events) return;
    const found = events.find((e) => e.id === id);
    if (found) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time deep link
      setSelected(new Date(found.starts_at));
      window.history.replaceState(null, "", "/plans");
    }
  }, [events]);

  useLiveTable("events", (change) => {
    const row = change.row as EventRow;
    setEvents((prev) => {
      if (!prev) return prev;
      const rest = prev.filter((e) => e.id !== row.id);
      return change.type === "DELETE" ? rest : [...rest, row].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    });
  });

  const byDay = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const e of events ?? []) {
      const key = dateKey(new Date(e.starts_at));
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events]);

  const dayEvents = byDay.get(dateKey(selected)) ?? [];
  const upcoming = (events ?? []).filter((e) => new Date(e.starts_at) >= today && !sameDay(new Date(e.starts_at), selected)).slice(0, 5);
  const who = (id: string) => (id === me.id ? "You" : partner.display_name);

  const move = (delta: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <>
      <PageHeader
        title="Plans"
        description={
          tab === "calendar"
            ? `Shared with ${partner.display_name}. Reminders go to both of you.`
            : `Shared with ${partner.display_name}. Tick things off together, live.`
        }
        action={
          tab === "calendar" ? (
            <Button onClick={() => setEditing("new")}>
              <PlusIcon size={18} /> Add
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-1 self-start rounded-full bg-panel-strong p-1" role="tablist" aria-label="Plans">
        {(["calendar", "lists"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => pickTab(t)}
            className={cn(
              "min-h-10 rounded-full px-5 text-small font-bold transition-colors",
              tab === t ? "bg-background text-foreground shadow-[var(--shadow-raised)]" : "text-muted-strong hover:text-foreground",
            )}
          >
            {t === "calendar" ? "Calendar" : "Lists"}
          </button>
        ))}
      </div>

      {tab === "lists" ? (
        <SharedLists />
      ) : (
      <>

      {error && (
        <div className="card flex items-center justify-between gap-3 bg-panel p-4" role="alert">
          <span className="text-small text-muted-strong">{error}</span>
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      <section className="card bg-panel p-4 sm:p-5" aria-labelledby="month-label">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => move(-1)} className="rounded-full flex size-11 items-center justify-center hover:bg-panel-strong" aria-label="Previous month">
            <ChevronLeftIcon size={20} />
          </button>
          <h2 id="month-label" className="text-title font-bold" aria-live="polite">
            {monthFormat.format(cursor)}
          </h2>
          <button type="button" onClick={() => move(1)} className="rounded-full flex size-11 items-center justify-center hover:bg-panel-strong" aria-label="Next month">
            <ChevronRightIcon size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center" role="grid" aria-labelledby="month-label">
          <div role="row" className="contents">
            {WEEKDAYS.map((d, i) => (
              <span key={i} role="columnheader" aria-label={WEEKDAY_NAMES[i]} className="pb-2 text-meta font-bold text-muted-strong">
                {d}
              </span>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, week) => (
            <div role="row" className="contents" key={week}>
              {grid.slice(week * 7, week * 7 + 7).map((day) => {
                const inMonth = day.getMonth() === cursor.getMonth();
                const isSelected = sameDay(day, selected);
                const isToday = sameDay(day, today);
                const count = byDay.get(dateKey(day))?.length ?? 0;
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${dayFormat.format(day)}${count ? `, ${count} plan${count > 1 ? "s" : ""}` : ""}`}
                    onClick={() => setSelected(day)}
                    className="group flex h-12 items-center justify-center"
                  >
                    {/* A circle, not the whole cell, so every day reads as a round dot on the grid. */}
                    <span
                      className={cn(
                        "relative flex size-11 items-center justify-center rounded-full font-mono text-body transition-colors",
                        !inMonth && "text-muted",
                        isSelected ? "bg-accent font-bold text-accent-foreground" : "group-hover:bg-panel-strong",
                        isToday && !isSelected && "font-bold text-accent-text ring-1 ring-field-border",
                      )}
                    >
                      {day.getDate()}
                      {count > 0 && (
                        <span className={cn("absolute bottom-1 size-1.5 rounded-full", isSelected ? "bg-accent-foreground" : "bg-accent")} aria-hidden="true" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="day-label">
        <h2 id="day-label" className="mb-3 text-title font-bold">
          {sameDay(selected, today) ? "Today" : dayFormat.format(selected)}
        </h2>
        {events === null ? (
          <Skeleton className="h-20 w-full" />
        ) : dayEvents.length === 0 ? (
          <div className="card flex items-center justify-between gap-3 bg-panel p-4">
            <p className="text-small text-muted-strong">Nothing planned.</p>
            <Button variant="secondary" onClick={() => setEditing("new")}>
              <PlusIcon size={16} /> Add a plan
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {dayEvents.map((e) => (
              <EventItem key={e.id} event={e} by={who(e.created_by)} onOpen={() => setEditing(e)} />
            ))}
          </ul>
        )}
      </section>

      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-label">
          <h2 id="upcoming-label" className="mb-3 text-title font-bold">
            Coming up
          </h2>
          <ul className="flex flex-col gap-2">
            {upcoming.map((e) => (
              <EventItem key={e.id} event={e} by={who(e.created_by)} showDate onOpen={() => setEditing(e)} />
            ))}
          </ul>
        </section>
      )}

      </>
      )}

      {editing && (
        <EventForm
          event={editing === "new" ? null : editing}
          defaultDate={selected}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEvents((prev) => [...(prev ?? []).filter((e) => e.id !== saved.id), saved].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
            setSelected(new Date(saved.starts_at));
            setEditing(null);
          }}
          onDeleted={(id) => {
            setEvents((prev) => prev?.filter((e) => e.id !== id) ?? null);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function EventItem({ event, by, showDate, onOpen }: { event: EventRow; by: string; showDate?: boolean; onOpen: () => void }) {
  const start = new Date(event.starts_at);
  return (
    <li>
      <button type="button" onClick={onOpen} className="card flex w-full items-start gap-4 bg-panel p-4 text-left transition-colors hover:bg-panel-strong">
        <span className="w-16 shrink-0 font-mono text-small font-bold text-accent-text">
          {event.all_day ? "All day" : timeFormat.format(start)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold break-words">{event.title}</span>
          {showDate && <span className="block text-small text-muted-strong">{shortDay.format(start)}</span>}
          {event.note && <span className="mt-1 block text-small break-words text-muted-strong">{event.note}</span>}
          <span className="mt-1 flex flex-wrap items-center gap-x-3 text-meta text-muted">
            <span>Added by {by}</span>
            {event.remind_minutes !== null && (
              <span className="inline-flex items-center gap-1">
                <BellIcon size={13} /> {reminderLabel(event.remind_minutes)}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function PlansSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading plans">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
