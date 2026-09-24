import type { Profile } from "@/types/app";

// Status icons are the game's field access icons (public/ui/status-*.png).
// The icon id is stored in profiles.status_emoji (the column predates icons;
// its 16-character limit fits every id). Old emoji values are ignored.
export const STATUS_ICONS = ["free", "busy", "studying", "home", "out", "sleeping", "urgent"] as const;

export type StatusIcon = (typeof STATUS_ICONS)[number];

export function isStatusIcon(value: unknown): value is StatusIcon {
  return STATUS_ICONS.includes(value as StatusIcon);
}

export const STATUS_PRESETS: ReadonlyArray<{ icon: StatusIcon; text: string }> = [
  { icon: "free", text: "Free to talk" },
  { icon: "busy", text: "Busy" },
  { icon: "studying", text: "Studying" },
  { icon: "home", text: "At home" },
  { icon: "out", text: "Out" },
  { icon: "sleeping", text: "Sleeping" },
  { icon: "urgent", text: "Call me" },
];

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

/** A daily status: it quietly expires after 24 hours. */
export function activeStatus(
  profile: Pick<Profile, "status_emoji" | "status_text" | "status_updated_at">,
  now = Date.now(),
): { icon: StatusIcon | null; text: string } | null {
  if (!profile.status_updated_at) return null;
  if (now - new Date(profile.status_updated_at).getTime() > STATUS_TTL_MS) return null;
  const icon = isStatusIcon(profile.status_emoji) ? profile.status_emoji : null;
  const text = profile.status_text?.trim() ?? "";
  if (!icon && !text) return null;
  return { icon, text: text || (STATUS_PRESETS.find((p) => p.icon === icon)?.text ?? "") };
}
