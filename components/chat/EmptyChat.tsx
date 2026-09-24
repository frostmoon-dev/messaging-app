"use client";

import { useChat } from "@/components/providers/ChatProvider";
import { ChatIcon } from "@/components/ui/icons";

export function EmptyChat() {
  const { partner } = useChat();
  return (
    <div className="mx-auto my-16 flex max-w-xs flex-col items-center px-6 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden="true">
        <ChatIcon size={26} />
      </span>
      <p className="text-title font-bold">No messages yet</p>
      <p className="mt-2 text-small text-muted-strong">
        Messages you send to {partner.display_name} show up here. Only the two of you can read them.
      </p>
    </div>
  );
}
