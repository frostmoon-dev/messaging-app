"use client";

import { useState } from "react";
import { PinIcon } from "@/components/ui/icons";
import { useChat } from "@/components/providers/ChatProvider";
import { snippetText } from "./ReplyQuote";

/**
 * The pins, one at a time, inside the header glass. Tap to jump to it; each
 * tap moves on to the next pin (newest first), like most messengers.
 */
export function PinnedBar({ onJump }: { onJump: (id: string) => void }) {
  const { pinned, me, partner } = useChat();
  const [index, setIndex] = useState(0);
  if (!pinned.length) return null;

  const i = index % pinned.length;
  const pin = pinned[i];
  const who = pin.sender_id === me.id ? "You" : partner.display_name;

  return (
    <button
      type="button"
      onClick={() => {
        onJump(pin.id);
        setIndex(i + 1);
      }}
      className="flex w-full items-center gap-3 border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] px-4 py-2 text-left transition-colors hover:bg-panel-strong/40"
      aria-label={`Pinned message ${i + 1} of ${pinned.length}, from ${who}: ${snippetText(pin)}. Show it.`}
    >
      <PinIcon size={16} className="shrink-0 text-muted-strong" />
      <span className="min-w-0 flex-1">
        <span className="block text-meta font-bold">
          Pinned{pinned.length > 1 ? ` · ${i + 1} of ${pinned.length}` : ""}
        </span>
        <span className="block truncate text-small text-muted-strong">
          {who}: {snippetText(pin)}
        </span>
      </span>
    </button>
  );
}
