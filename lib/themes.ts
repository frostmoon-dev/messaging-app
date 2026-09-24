export const THEMES = [
  { id: "darkhour", name: "Dark Hour", description: "Deep blue, cyan light." },
  { id: "phantom", name: "Phantom", description: "Black, paper white, loud red." },
  { id: "midnight", name: "Midnight", description: "Softer panels for late nights." },
  { id: "cobalt", name: "Cobalt", description: "Same energy, blue accent." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "darkhour";
export const THEME_COOKIE = "hl-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export const THEME_COLORS: Record<ThemeId, string> = {
  darkhour: "#040a17",
  phantom: "#0a0a0b",
  midnight: "#09090c",
  cobalt: "#07090f",
};
