export const THEMES = [
  { id: "system", name: "Automatic", description: "Follows your device." },
  { id: "dark", name: "Dark", description: "Easier on the eyes at night." },
  { id: "light", name: "Light", description: "Best in bright rooms." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "system";
export const THEME_COOKIE = "hl-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Browser chrome colour (<meta name="theme-color">) for each resolved scheme. */
export const SCHEME_COLORS = { dark: "#111113", light: "#f6f4f1" } as const;
