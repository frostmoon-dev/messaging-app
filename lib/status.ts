import type { Profile } from "@/types/app";

export const STATUS_PRESETS = [
  { emoji: "☕", text: "working" },
  { emoji: "🌙", text: "sleepy" },
  { emoji: "🎮", text: "gaming" },
  { emoji: "🍜", text: "eating" },
  { emoji: "💻", text: "coding" },
  { emoji: "📚", text: "studying" },
  { emoji: "🚗", text: "on the way" },
  { emoji: "🏃", text: "out" },
] as const;

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

/** A daily status: it quietly expires after 24 hours. */
export function activeStatus(profile: Pick<Profile, "status_emoji" | "status_text" | "status_updated_at">, now = Date.now()) {
  if (!profile.status_emoji && !profile.status_text) return null;
  if (!profile.status_updated_at) return null;
  if (now - new Date(profile.status_updated_at).getTime() > STATUS_TTL_MS) return null;
  return { emoji: profile.status_emoji ?? "", text: profile.status_text ?? "" };
}
