"use client";

import { useChat } from "@/components/providers/ChatProvider";

export function EmptyChat() {
  const { partner } = useChat();
  return (
    <div className="chat-note mx-auto my-16 flex max-w-xs flex-col items-center px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand image */}
      <img src="/brand-mark@4x.png" alt="" width={96} height={96} className="mb-5 size-24" />
      <p className="text-title font-bold">No messages yet</p>
      <p className="mt-2 text-body text-muted-strong">Say hello to {partner.display_name}.</p>
    </div>
  );
}
