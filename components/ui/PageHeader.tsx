import type { ReactNode } from "react";

/** Screen title with a short ink stroke under it, and an optional action on the right. */
export function PageHeader({ title, description, action }: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div>
      {/* Title and action share one row, centred on each other; the description runs full width below. */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="page-title min-w-0 text-display">{title}</h1>
        {action}
      </div>
      <span className="ink-stroke mt-3" aria-hidden="true" />
      {description && <p className="mt-3 text-small text-muted-strong">{description}</p>}
    </div>
  );
}
