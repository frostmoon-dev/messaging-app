export const THEMES = [
  { id: "system", name: "Automatic", description: "Follows your device." },
  { id: "phantom", name: "Phantom", description: "Black, white and red. Best at night." },
  { id: "paper", name: "Paper", description: "White paper with black and red." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "system";
export const THEME_COOKIE = "hl-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Browser chrome colour for each scheme. Matches --background in globals.css. */
export const SCHEME_COLORS = {
  dark: "#0a0a0b",
  light: "#f3f1ee",
} as const;

export type Scheme = keyof typeof SCHEME_COLORS;

export function themeScheme(theme: Exclude<ThemeId, "system">): Scheme {
  return theme === "paper" ? "light" : "dark";
}
