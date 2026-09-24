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
        "mb-1.5 block w-full px-3 py-1.5 text-left text-small transition-colors",
        tone === "outgoing"
          ? "border-l-4 border-current bg-current/10 hover:bg-current/15"
          : "border-l-4 border-accent bg-current/10 hover:bg-current/15",
      )}
      aria-label={`Replying to ${authorName}: ${snippetText(snippet)}. Jump to message.`}
    >
      <span className="block text-meta font-bold">{authorName}</span>
      <span className="line-clamp-2 break-words [overflow-wrap:anywhere]">{snippetText(snippet)}</span>
    </button>
  );
}
