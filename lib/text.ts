const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;
const PICTOGRAPH = /\p{Extended_Pictographic}/gu;

/** 1–3 emoji and nothing else → rendered larger. */
export function isEmojiOnly(text: string | null | undefined) {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed || !EMOJI_ONLY.test(trimmed) || /\d/.test(trimmed)) return false;
  const count = trimmed.match(PICTOGRAPH)?.length ?? 0;
  return count > 0 && count <= 3;
}

export type TextToken = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]}]/gi;

/**
 * Splits plain text into text and link tokens. Rendered by React as text
 * nodes and <a> elements, so no HTML from the message is ever interpreted.
 */
export function tokenize(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    let href: string | null = null;
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" || url.protocol === "http:") href = url.href;
    } catch {
      href = null;
    }
    if (!href) continue;
    if (start > last) tokens.push({ type: "text", value: text.slice(last, start) });
    tokens.push({ type: "link", value: raw, href });
    last = start + raw.length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}
