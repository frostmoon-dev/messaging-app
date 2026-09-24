export const THEMES = [
  { id: "system", name: "Automatic", description: "Follows your device: Phantom at night, Paper by day." },
  { id: "phantom", name: "Phantom", description: "Black, white and red." },
  { id: "paper", name: "Paper", description: "Warm paper with black and red." },
  { id: "mooncell", name: "Moon Cell", description: "The digital moon. Teal space, data green." },
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
  phantom: "#141416",
  paper: "#f2f0ec",
  mooncell: "#0e171b",
};

/** What "Automatic" picks for each device setting. */
export const SCHEME_COLORS = {
  dark: THEME_COLORS.phantom,
  light: THEME_COLORS.paper,
} as const;

export type Scheme = keyof typeof SCHEME_COLORS;

export function themeScheme(theme: FixedThemeId): Scheme {
  return theme === "paper" ? "light" : "dark";
}
