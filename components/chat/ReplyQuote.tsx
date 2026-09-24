"use client";

import { cn } from "@/lib/utils";
import type { ReplySnippet } from "@/types/app";

export function snippetText(snippet: ReplySnippet | undefined) {
  if (!snippet) return "Original message";
  if (snippet.message_type === "image") return snippet.content ? `Photo: ${snippet.content}` : "Photo";
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
        "mb-1.5 block w-full rounded-[10px] px-3 py-1.5 text-left text-small transition-colors",
        tone === "outgoing" ? "bg-black/20 hover:bg-black/30" : "bg-black/[0.08] hover:bg-black/[0.12]",
      )}
      aria-label={`Replying to ${authorName}: ${snippetText(snippet)}. Jump to message.`}
    >
      <span className="block text-meta font-bold">{authorName}</span>
      <span className="line-clamp-2 break-words opacity-90 [overflow-wrap:anywhere]">{snippetText(snippet)}</span>
    </button>
  );
}
