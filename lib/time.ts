const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const longDateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

export function formatTime(iso: string | Date) {
  return timeFormat.format(new Date(iso));
}

export function isSameDay(a: string | Date, b: string | Date) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

function daysBetween(a: Date, b: Date) {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((end - start) / 86_400_000);
}

/** "TODAY", "YESTERDAY", "WED", "24 SEP" or "24 SEP 2025". */
export function formatDayLabel(iso: string | Date, now = new Date()) {
  const d = new Date(iso);
  const diff = daysBetween(d, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return weekdayFormat.format(d);
  if (d.getFullYear() === now.getFullYear()) return dateFormat.format(d);
  return longDateFormat.format(d);
}

/** "LAST SEEN 17:42", "LAST SEEN YESTERDAY 23:10", "LAST SEEN 12 SEP". */
export function formatLastSeen(iso: string | null | undefined, now = new Date()) {
  if (!iso) return "Offline";
  const d = new Date(iso);
  const diff = daysBetween(d, now);
  if (diff <= 0) return `Last seen ${formatTime(d)}`;
  if (diff === 1) return `Last seen yesterday ${formatTime(d)}`;
  return `Last seen ${formatDayLabel(d, now)}`;
}

export function formatLongDate(iso: string | Date) {
  return longDateFormat.format(new Date(iso));
}

/** Whole days from a date (YYYY-MM-DD) until today, counting the first day. */
export function daysSince(dateOnly: string, now = new Date()) {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return Math.max(0, daysBetween(new Date(y, m - 1, d), now) + 1);
}

export function minutesApart(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000;
}

export function todayDateOnly(now = new Date()) {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}
