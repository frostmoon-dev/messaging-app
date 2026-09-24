"use client";

import { cn } from "@/lib/utils";
import type { ReplySnippet } from "@/types/app";

export function snippetText(snippet: ReplySnippet | undefined) {
  if (!snippet) return "Original message";
  if (snippet.message_type === "image") return snippet.content ? `📷 ${snippet.content}` : "📷 Photo";
  return snippet.content ?? "";
}

/** The quoted message shown inside a reply bubble. Click to jump. */
export function ReplyQuote({
  snippet,
  authorName,
  onClick,
  tone,
}: {
  snippet: ReplySnippet | undefined;
  authorName: string;
  onClick: () => void;
  tone: "incoming" | "outgoing";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mb-1.5 block w-full border-l-[3px] px-2.5 py-1.5 text-left text-[13px] leading-snug transition-opacity hover:opacity-80",
        tone === "outgoing"
          ? "border-white/80 bg-black/20 text-white/90"
          : "border-accent bg-black/[0.07] text-incoming-foreground/80",
      )}
      aria-label={`Replying to ${authorName}: ${snippetText(snippet)}. Jump to message.`}
    >
      <span className="text-display block text-[10px] tracking-[0.2em] opacity-80">{authorName}</span>
      <span className="line-clamp-2 break-words [overflow-wrap:anywhere]">{snippetText(snippet)}</span>
    </button>
  );
}
