import type { ReactNode } from "react";

/** Screen title with an optional one-line description and action. */
export function PageHeader({ title, description, action }: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-heading font-bold">{title}</h1>
        {description && <p className="mt-1 text-small text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
