import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

/** Original wordmark: condensed type, a slash, a red block. */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const [head, tail] = [APP_NAME.slice(0, 5), APP_NAME.slice(5)];
  return (
    <span className={cn("text-display inline-flex items-center", size === "lg" ? "text-6xl" : "text-2xl", className)}>
      <span className="-skew-x-6">{head}</span>
      <span className="shape-tag mx-0.5 -skew-x-6 bg-accent px-1.5 text-accent-foreground">{tail}</span>
    </span>
  );
}
