// Date helpers for the shared calendar. All in the viewer's local time.

export const REMINDERS = [
  { minutes: null, label: "No reminder" },
  { minutes: 0, label: "When it starts" },
  { minutes: 10, label: "10 minutes before" },
  { minutes: 30, label: "30 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 120, label: "2 hours before" },
  { minutes: 1440, label: "1 day before" },
] as const;

export type ReminderMinutes = (typeof REMINDERS)[number]["minutes"];

export function reminderLabel(minutes: number | null) {
  return REMINDERS.find((r) => r.minutes === minutes)?.label ?? "No reminder";
}

/** "2026-09-24" for a local date. */
export function dateKey(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "18:30" for a local time. */
export function timeKey(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// All-day plans are stored at 09:00 local time, so "when it starts" and
// "1 day before" reminders arrive in the morning, not at midnight.
export const ALL_DAY_TIME = "09:00";

/** Local date + time from the form → ISO timestamp for the database. */
export function toStartsAt(date: string, time: string, allDay: boolean) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (allDay ? ALL_DAY_TIME : time).split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

/**
 * The 6×7 grid of days shown for a month, weeks starting on Monday.
 * Includes the trailing days of the previous month and leading days of the next.
 */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
