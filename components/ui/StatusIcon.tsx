import { UiMark } from "./UiMark";
import { cn } from "@/lib/utils";
import type { StatusIcon as StatusIconId } from "@/lib/status";

/** A status icon (the game's field access icons), red by default. Decorative. */
export function StatusIcon({ icon, className }: { icon: StatusIconId; className?: string }) {
  return <UiMark name={`status-${icon}`} className={cn("size-5 bg-accent", className)} />;
}
