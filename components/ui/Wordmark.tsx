import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

/** The app mark (same shape as the app icon) followed by the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-title font-bold", className)}>
      <svg viewBox="0 0 512 512" className="size-7 rounded-[8px]" aria-hidden="true" focusable="false">
        <rect width="512" height="512" fill="var(--accent)" />
        <path d="M150 128v256M362 128v256M150 256h212" stroke="#fff" strokeWidth="64" strokeLinecap="round" fill="none" />
      </svg>
      <span className="tracking-[0.04em]">{APP_NAME.charAt(0) + APP_NAME.slice(1).toLowerCase()}</span>
    </span>
  );
}
