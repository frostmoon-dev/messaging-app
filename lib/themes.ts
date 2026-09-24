export const THEMES = [
  { id: "system", name: "Automatic", description: "Follows your device." },
  { id: "darkhour", name: "Dark Hour", description: "Deep blue. Easy on the eyes at night." },
  { id: "daylight", name: "Daylight", description: "Light blue and white." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "system";
export const THEME_COOKIE = "hl-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Browser chrome colour for each scheme. Matches --background in globals.css. */
export const SCHEME_COLORS = {
  dark: "#06112a",
  light: "#eef3fb",
} as const;

export type Scheme = keyof typeof SCHEME_COLORS;

export function themeScheme(theme: Exclude<ThemeId, "system">): Scheme {
  return theme === "daylight" ? "light" : "dark";
}
