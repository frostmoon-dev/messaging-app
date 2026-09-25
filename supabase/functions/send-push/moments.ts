// Pure date helpers for anniversaries. No imports, no Deno globals, so the
// app (Bond screen) and its unit tests can import this file too.
//
// Dates are date-only strings (YYYY-MM-DD) in the couple's local time.
// Day counts match the Bond screen's "Days together": the first day is day 1.

export type Milestone = {
  /** Unique per couple, so each milestone is sent once. */
  key: string;
  /** "100 days", "6 months", "1 year", "2 years" */
  label: string;
};

type Ymd = { y: number; m: number; d: number };

function parse(date: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function dayNumber({ y, m, d }: Ymd) {
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function formatDateOnly(date: string) {
  const p = parse(date);
  if (!p) return date;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(p.y, p.m - 1, p.d)),
  );
}

/** Adds days to a date-only string. */
export function addDays(date: string, days: number) {
  const p = parse(date);
  if (!p) return date;
  return new Date(Date.UTC(p.y, p.m - 1, p.d + days)).toISOString().slice(0, 10);
}

/**
 * Whole months from `since` to `today` when today is a "monthiversary",
 * else null. A start on the 31st lands on the last day of shorter months;
 * a start on 29 February lands on 28 February in other years.
 */
function monthsOn(since: Ymd, today: Ymd): number | null {
  const months = (today.y - since.y) * 12 + (today.m - since.m);
  if (months <= 0) return null;
  const expected = Math.min(since.d, daysInMonth(today.y, today.m));
  return today.d === expected ? months : null;
}

/** The milestone that falls on `today`, if any. Years win over day counts, day counts over months. */
export function milestoneOn(since: string, today: string): Milestone | null {
  const s = parse(since);
  const t = parse(today);
  if (!s || !t) return null;
  const day = dayNumber(t) - dayNumber(s) + 1;
  if (day <= 1) return null;

  const months = monthsOn(s, t);
  if (months !== null && months % 12 === 0) {
    const years = months / 12;
    return { key: `years:${years}`, label: years === 1 ? "1 year" : `${years} years` };
  }
  if (day === 100 || day === 500 || day % 1000 === 0) {
    return { key: `days:${day}`, label: `${day.toLocaleString("en-US")} days` };
  }
  if (months === 1 || months === 6) {
    return { key: `months:${months}`, label: months === 1 ? "1 month" : "6 months" };
  }
  return null;
}

/** The next milestone after `today` (within about 14 months), with how many days away it is. */
export function nextMilestone(since: string, today: string): (Milestone & { date: string; daysLeft: number }) | null {
  if (!parse(since) || !parse(today)) return null;
  for (let i = 1; i <= 430; i++) {
    const date = addDays(today, i);
    const found = milestoneOn(since, date);
    if (found) return { ...found, date, daysLeft: i };
  }
  return null;
}

/** "1 year ago", "3 years ago" */
export function yearsAgo(memoryDate: string, today: string) {
  const m = parse(memoryDate);
  const t = parse(today);
  const years = m && t ? t.y - m.y : 0;
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

/** Today's date-only string in `timeZone` (UTC when unknown or invalid). */
export function localDate(now: Date, timeZone: string | null | undefined) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
