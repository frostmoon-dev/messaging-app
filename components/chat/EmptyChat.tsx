"use client";

import { useChat } from "@/components/providers/ChatProvider";
import { UiMark } from "@/components/ui/UiMark";

export function EmptyChat() {
  const { partner } = useChat();
  return (
    <div className="chat-note mx-auto my-16 flex max-w-xs flex-col items-center px-6 text-center">
      <UiMark name="talk" className="mb-5 h-20 w-24 bg-accent" />
      <p className="text-title font-bold">No messages yet</p>
      <p className="mt-2 text-body text-muted-strong">Say hello to {partner.display_name}.</p>
    </div>
  );
}
