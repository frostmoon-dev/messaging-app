// Non-sensitive UI preferences only. Never store messages or tokens here.
const PREFIX = "hl:";

export function readPref(key: string, fallback: string | null = null): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Storage can be unavailable (private mode). Preferences are optional.
  }
}
