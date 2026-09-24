// Time of day and moon phase for the header clock, in the spirit of the
// in-game calendar. Everything uses the viewer's local time.

export const DAY_PARTS = [
  { id: "lateatnight", label: "Late at night", from: 0 },
  { id: "morning", label: "Morning", from: 5 },
  { id: "daytime", label: "Daytime", from: 10 },
  { id: "lunchtime", label: "Lunchtime", from: 12 },
  { id: "afternoon", label: "Afternoon", from: 14 },
  { id: "nighttime", label: "Nighttime", from: 18 },
  { id: "lateatnight", label: "Late at night", from: 23 },
] as const;

export type DayPart = (typeof DAY_PARTS)[number];

export function dayPart(now = new Date()): DayPart {
  const hour = now.getHours();
  let part: DayPart = DAY_PARTS[0];
  for (const p of DAY_PARTS) if (hour >= p.from) part = p;
  return part;
}

const SYNODIC_MONTH = 29.530588853;
// A known new moon: 6 Jan 2000, 18:14 UTC.
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);

const PHASE_NAMES = [
  "New moon",
  "Waxing crescent",
  "First quarter",
  "Waxing gibbous",
  "Full moon",
  "Waning gibbous",
  "Last quarter",
  "Waning crescent",
] as const;

/** Position in the lunar cycle: 0 = new, 0.5 = full, approaching 1 = new again. */
export function moonAge(now = new Date()) {
  const days = (now.getTime() - NEW_MOON_EPOCH) / 86_400_000;
  const cycles = days / SYNODIC_MONTH;
  return cycles - Math.floor(cycles);
}

export function moonPhaseName(age: number) {
  return PHASE_NAMES[Math.round(age * 8) % 8];
}
