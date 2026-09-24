/**
 * Chat background, saved on this device only (like the theme). A photo is
 * kept as a small WebP data URL, so it needs no upload and no one else sees
 * it. Every read and write can fail (private mode, full storage), so the
 * chat falls back to the plain background.
 */
export const PATTERNS = [
  { id: "dots", name: "Dots" },
  { id: "grid", name: "Grid" },
  { id: "slash", name: "Slash" },
] as const;

export type PatternId = (typeof PATTERNS)[number]["id"];

export type ChatBackground =
  | { kind: "none" }
  | { kind: "pattern"; pattern: PatternId }
  | { kind: "photo"; src: string; dim: number };

/** How much of the theme background covers a photo, so it never fights the messages. */
export const MIN_DIM = 0.3;
export const MAX_DIM = 0.85;
export const DEFAULT_DIM = 0.55;

const KEY = "napyru:chat-background";
const EVENT = "napyru:chat-background";
const NONE: ChatBackground = { kind: "none" };

export function parseChatBackground(raw: string | null): ChatBackground {
  if (!raw) return NONE;
  try {
    const value = JSON.parse(raw) as Partial<{ kind: string; pattern: string; src: string; dim: number }>;
    if (value.kind === "pattern" && PATTERNS.some((p) => p.id === value.pattern)) {
      return { kind: "pattern", pattern: value.pattern as PatternId };
    }
    if (value.kind === "photo" && typeof value.src === "string" && value.src.startsWith("data:image/")) {
      const dim = typeof value.dim === "number" ? value.dim : DEFAULT_DIM;
      return { kind: "photo", src: value.src, dim: Math.min(MAX_DIM, Math.max(MIN_DIM, dim)) };
    }
  } catch {
    // Unreadable: treat as no background.
  }
  return NONE;
}

// useSyncExternalStore needs the same object back while nothing changed.
let cached: { raw: string | null; value: ChatBackground } = { raw: null, value: NONE };

export function getChatBackground(): ChatBackground {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return NONE;
  }
  if (raw !== cached.raw) cached = { raw, value: parseChatBackground(raw) };
  return cached.value;
}

export function getServerChatBackground(): ChatBackground {
  return NONE;
}

/** Returns false when the browser refused to store it (usually: photo too big). */
export function setChatBackground(value: ChatBackground): boolean {
  try {
    if (value.kind === "none") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(EVENT));
  return true;
}

export function subscribeChatBackground(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
