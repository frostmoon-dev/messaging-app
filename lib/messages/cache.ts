import type { MessageRow } from "@/types/app";

/**
 * The newest messages of the chat, kept on this device so the chat opens
 * instantly; the server copy replaces it a moment later. Only on this
 * device, only the latest page, and wiped on sign-out.
 */
const PREFIX = "napyru:chat:v1:";
const KEEP = 60;

type Cached = { rows: MessageRow[]; hasMore: boolean };

export function readChatCache(conversationId: string): Cached | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + conversationId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    return Array.isArray(parsed?.rows) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeChatCache(conversationId: string, rows: MessageRow[], hasMore: boolean) {
  try {
    const confirmed = rows.filter((r) => !(r as { local?: unknown }).local).slice(-KEEP);
    // Drop client-only fields.
    const clean = confirmed.map((r) => {
      const copy = { ...r } as MessageRow & { local?: unknown };
      delete copy.local;
      return copy;
    });
    const value: Cached = { rows: clean, hasMore: hasMore || rows.length > KEEP };
    window.localStorage.setItem(PREFIX + conversationId, JSON.stringify(value));
  } catch {
    // Full or unavailable storage: the chat still loads from the server.
  }
}

export function clearChatCaches() {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    // Nothing to clear.
  }
}
