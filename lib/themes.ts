export const THEMES = [
  { id: "system", name: "Automatic", description: "Follows your device: Ink at night, Paper by day." },
  { id: "ink", name: "Ink", description: "Soft black and white, like the icon." },
  { id: "paper", name: "Paper", description: "Warm paper and ink." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type FixedThemeId = Exclude<ThemeId, "system">;

export const DEFAULT_THEME: ThemeId = "system";
export const THEME_COOKIE = "hl-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Browser chrome colour for each theme. Matches --background in globals.css. */
export const THEME_COLORS: Record<FixedThemeId, string> = {
  ink: "#151312",
  paper: "#f3efe9",
};

/** What "Automatic" picks for each device setting. */
export const SCHEME_COLORS = {
  dark: THEME_COLORS.ink,
  light: THEME_COLORS.paper,
} as const;

export type Scheme = keyof typeof SCHEME_COLORS;

export function themeScheme(theme: FixedThemeId): Scheme {
  return theme === "paper" ? "light" : "dark";
}
