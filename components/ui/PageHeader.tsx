import type { ReactNode } from "react";

/**
 * Screen title as a Persona 5 label: heavy capitals on a paper strip with
 * a red block behind. The description stays in normal sentence case.
 */
export function PageHeader({ title, description, action }: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="p5-title text-display">{title}</h1>
        {description && <p className="mt-4 text-small text-muted-strong">{description}</p>}
      </div>
      {action}
    </div>
  );
}
