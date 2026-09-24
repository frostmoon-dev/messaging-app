import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

/** The app mark (same shape as the app icon) followed by the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 512 512" className="size-8 rounded-[6px]" aria-hidden="true" focusable="false">
        <rect width="512" height="512" fill="#1c5fe0" />
        <path d="M150 128v256M362 128v256M150 256h212" stroke="#fff" strokeWidth="64" strokeLinecap="round" fill="none" />
      </svg>
      <span className="title-caps text-title">{APP_NAME}</span>
    </span>
  );
}
