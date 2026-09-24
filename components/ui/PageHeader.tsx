import type { ReactNode } from "react";
import { UiMark } from "./UiMark";

/**
 * Screen title in the game's menu style: a cyan slash, then one or two
 * heavy capital words. The description stays in sentence case.
 */
export function PageHeader({ title, description, action }: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="title-caps flex items-center gap-2 text-display">
          <UiMark name="slash" className="h-9 w-7 bg-accent" />
          {title}
        </h1>
        {description && <p className="mt-2 text-small text-muted-strong">{description}</p>}
      </div>
      {action}
    </div>
  );
}
