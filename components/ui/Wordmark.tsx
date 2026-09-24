import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

/** The app mark (sun and moon, same file as the app icon) followed by the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, no optimisation needed */}
      <img src="/brand-mark.svg" alt="" width={32} height={32} className="p5-frame size-8" />
      <span className="text-title font-extrabold tracking-wide uppercase">{APP_NAME}</span>
    </span>
  );
}
