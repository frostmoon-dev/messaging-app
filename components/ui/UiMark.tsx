import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type MarkName =
  | "talk"
  | "alert"
  | "arcana"
  | "sakura"
  | "chevron"
  | "slash"
  | "rankup"
  | `time-${"morning" | "daytime" | "lunchtime" | "afternoon" | "nighttime" | "lateatnight"}`;

/**
 * One of the single-colour shapes in public/ui, painted with the current
 * text colour (or a bg-* class). Decorative unless given a label.
 */
export function UiMark({ name, label, className }: { name: MarkName; label?: string; className?: string }) {
  return (
    <span
      className={cn("ui-mark", className)}
      style={{ "--mark": `url(/ui/${name}.png)` } as CSSProperties}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}
