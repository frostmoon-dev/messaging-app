"use client";

import { useChat } from "@/components/providers/ChatProvider";
import { UiMark } from "@/components/ui/UiMark";

export function EmptyChat() {
  const { partner } = useChat();
  return (
    <div className="mx-auto my-16 flex max-w-xs flex-col items-center px-6 text-center">
      <span className="relative mb-6 flex h-28 w-32 items-center justify-center">
        <UiMark name="talk" className="absolute inset-0 bg-foreground" />
        <span className="text-display relative -mt-3 text-2xl text-background" aria-hidden="true">
          …
        </span>
      </span>
      <p className="text-display text-2xl tracking-wide">No messages yet</p>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-strong">
        Say something to {partner.display_name}. The first line is always the hardest.
      </p>
    </div>
  );
}
