"use client";

import { useSyncExternalStore } from "react";
import { dayPart, moonAge, moonPhaseName } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const shortFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const fullFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

// Ticks once a minute. The server has no idea of the viewer's clock, so it
// renders nothing and the client fills in after hydration.
let minute = 0;
function subscribe(onChange: () => void) {
  const id = setInterval(() => {
    const m = Math.floor(Date.now() / 60_000);
    if (m !== minute) {
      minute = m;
      onChange();
    }
  }, 5_000);
  return () => clearInterval(id);
}
const getSnapshot = () => (minute ||= Math.floor(Date.now() / 60_000));
const getServerSnapshot = () => 0;

/** Date, tonight's moon and the time of day, quietly, in the corner of the header. */
export function DayClock({ className }: { className?: string }) {
  const tick = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!tick) return <span className={cn("block h-6 w-56", className)} aria-hidden="true" />;

  const now = new Date(tick * 60_000);
  const part = dayPart(now);
  const age = moonAge(now);
  const phase = moonPhaseName(age);

  return (
    <p className={cn("flex items-center gap-2.5 text-small", className)}>
      <span className="sr-only">
        {fullFormat.format(now)}. {part.label}. {phase}.
      </span>
      <span className="font-semibold" aria-hidden="true">
        {shortFormat.format(now)}
      </span>
      <span className="text-muted" aria-hidden="true">·</span>
      <MoonPhase age={age} size={18} />
      <span className="text-muted-strong" aria-hidden="true">
        {part.label}
      </span>
    </p>
  );
}

/** Lit part of the moon, drawn from the phase: a half disc plus an elliptical terminator. */
// The lit part is always light grey, so the moon reads the same on Ink and Paper.
function MoonPhase({ age, size = 24 }: { age: number; size?: number }) {
  const r = 10;
  const waxing = age < 0.5;
  const t = waxing ? age : 1 - age; // 0 = new, 0.5 = full
  const rx = r * Math.abs(Math.cos(2 * Math.PI * t));
  const gibbous = t > 0.25;
  // Lit on the right while waxing (northern hemisphere view); mirrored when waning.
  const lit = `M12 ${12 - r} A${r} ${r} 0 0 1 12 ${12 + r} A${rx.toFixed(2)} ${r} 0 0 ${gibbous ? 1 : 0} 12 ${12 - r}Z`;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r={r} className="fill-panel-strong stroke-muted" strokeWidth="1" />
      {t > 0.02 && <path d={lit} fill="#ececec" transform={waxing ? undefined : "matrix(-1 0 0 1 24 0)"} />}
    </svg>
  );
}
