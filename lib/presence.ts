import type { ChatMessage } from "@/types/app";

/**
 * When the partner was last around. Takes the newest of: the last_seen on
 * their profile, the moment we saw them go offline, their newest message,
 * and the latest time they read one of our messages. Any of these alone can
 * be stale (a phone may freeze the app before it writes last_seen).
 */
export function latestSeen(
  stored: string | null,
  leftAt: string | null,
  messages: ChatMessage[],
  partnerId: string,
): string | null {
  let best = stored;
  const consider = (t: string | null | undefined) => {
    if (t && (!best || t > best)) best = t;
  };
  consider(leftAt);
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.local) continue;
    if (m.sender_id === partnerId) consider(m.created_at);
    else consider(m.read_at);
  }
  return best;
}
