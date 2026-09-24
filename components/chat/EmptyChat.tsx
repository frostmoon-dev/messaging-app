"use client";

import { useChat } from "@/components/providers/ChatProvider";
import { UiMark } from "@/components/ui/UiMark";

export function EmptyChat() {
  const { partner } = useChat();
  return (
    <div className="mx-auto my-16 flex max-w-xs flex-col items-center px-6 text-center">
      <UiMark name="talk" className="mb-5 h-20 w-24 bg-accent" />
      <p className="text-title font-bold">
        <span className="quirk-default">No messages yet</span>
        <span className="quirk-mooncell">No records on the Moon Cell yet</span>
      </p>
      <p className="mt-2 text-body text-muted-strong">
        <span className="quirk-default">Say hello to {partner.display_name}.</span>
        <span className="quirk-mooncell">Open the first channel to {partner.display_name}.</span>
      </p>
    </div>
  );
}
