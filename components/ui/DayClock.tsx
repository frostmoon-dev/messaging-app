"use client";

import { useSyncExternalStore } from "react";
import { UiMark } from "@/components/ui/UiMark";
import { dayPart, moonAge, moonPhaseName } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" });
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });
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

/** Date, weekday tag, moon phase and time of day, like the calendar in the corner of the game screen. */
export function DayClock({ className }: { className?: string }) {
  const tick = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!tick) return <span className={cn("block h-10 w-56", className)} aria-hidden="true" />;

  const now = new Date(tick * 60_000);
  const part = dayPart(now);
  const age = moonAge(now);
  const phase = moonPhaseName(age);

  return (
    <p className={cn("flex items-center gap-3", className)}>
      <span className="sr-only">
        {fullFormat.format(now)}. {part.label}. {phase}.
      </span>
      <span className="flex items-baseline gap-2" aria-hidden="true">
        <span className="font-mono text-heading font-bold">{dateFormat.format(now)}</span>
        <span className="p5-button bg-accent px-2 py-0.5 text-small font-extrabold text-accent-foreground uppercase">
          {weekdayFormat.format(now)}
        </span>
      </span>
      <MoonPhase age={age} />
      <UiMark name={`time-${part.id}`} className="h-4 w-28 bg-foreground [--mark-position:left]" />
    </p>
  );
}

/** Lit part of the moon, drawn from the phase: a half disc plus an elliptical terminator. */
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
      {t > 0.02 && <path d={lit} className="fill-foreground" transform={waxing ? undefined : "matrix(-1 0 0 1 24 0)"} />}
    </svg>
  );
}
