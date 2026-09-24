import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

/** The app mark (same shape as the app icon) followed by the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 512 512" className="p5-frame size-8" aria-hidden="true" focusable="false">
        <rect width="512" height="512" fill="#e5102b" />
        <path d="M150 128v256M362 128v256M150 256h212" stroke="#fff" strokeWidth="64" strokeLinecap="square" fill="none" />
      </svg>
      <span className="text-title font-extrabold tracking-wide uppercase">{APP_NAME}</span>
    </span>
  );
}
