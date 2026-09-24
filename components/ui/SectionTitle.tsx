import { cn } from "@/lib/utils";

/** Big slanted heading with a red slash behind it. */
export function SectionTitle({ children, kicker, className, as: Tag = "h1" }: {
  children: React.ReactNode;
  kicker?: string;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("relative", className)}>
      {kicker && (
        <p className="text-display mb-1 text-xs tracking-[0.3em] text-accent-strong">{kicker}</p>
      )}
      <Tag className="text-display relative inline-block text-4xl sm:text-5xl">
        <span
          className="absolute -inset-x-2 bottom-1 -z-0 h-3 -skew-x-12 bg-accent/80 sm:h-4"
          aria-hidden="true"
        />
        <span className="relative">{children}</span>
      </Tag>
    </div>
  );
}
