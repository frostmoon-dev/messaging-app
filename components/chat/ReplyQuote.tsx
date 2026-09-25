"use client";

import { cn } from "@/lib/utils";
import type { ReplySnippet } from "@/types/app";

export function snippetText(snippet: ReplySnippet | undefined) {
  if (!snippet) return "Original message";
  if (snippet.deleted_at) return "Deleted message";
  if (snippet.message_type === "image") return snippet.content ? `Photo: ${snippet.content}` : "Photo";
  if (snippet.message_type === "sticker") return "Sticker";
  if (snippet.message_type === "gif") return snippet.content ? `GIF: ${snippet.content}` : "GIF";
  if (snippet.message_type === "voice") return "Voice message";
  return snippet.content ?? "";
}

/** The quoted message shown inside a reply bubble. Click to jump. */
export function ReplyQuote({
  snippet,
  authorName,
  onClick,
  className,
}: {
  snippet: ReplySnippet | undefined;
  authorName: string;
  onClick: () => void;
  /** Corner radius, matched to the bubble around it (outer radius minus padding). */
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative mb-1.5 block w-full py-1.5 pr-3 pl-4 text-left text-small transition-colors",
        "bg-current/10 hover:bg-current/15",
        className,
      )}
      aria-label={`Replying to ${authorName}: ${snippetText(snippet)}. Jump to message.`}
    >
      {/* A rounded bar inside the box instead of a square left border, so every corner stays round. */}
      <span className="absolute top-1.5 bottom-1.5 left-1.5 w-[3px] rounded-full bg-current" aria-hidden="true" />
      <span className="block text-meta font-bold">{authorName}</span>
      <span className="line-clamp-2 wrap-anywhere">{snippetText(snippet)}</span>
    </button>
  );
}
