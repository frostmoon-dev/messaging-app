/**
 * GIPHY search results, trimmed to what the picker and the message need.
 * Shared by the server route (which calls GIPHY) and the picker.
 *
 * API: https://api.giphy.com/v1/{gifs|stickers}/{search|trending}
 * (as used by GIPHY's own @giphy/js-fetch-api). Tenor is not an option:
 * Google shut its API down on 30 June 2026.
 */
export type GiphyKind = "gifs" | "stickers";

export type GiphyItem = {
  id: string;
  title: string;
  /** Small, animated, for the picker grid. */
  preview: string;
  /** Small still frame, for people who reduce motion. */
  still: string;
  /** What the message stores: an MP4 for GIFs, an animated WebP for stickers (keeps transparency). */
  send: string;
  width: number;
  height: number;
};

export type GiphyPage = { items: GiphyItem[]; next: number | null };

/** The only hosts a GIF or sticker message may point at (the database checks the same). */
export const GIPHY_MEDIA = /^https:\/\/(media[0-9]*|i)\.giphy\.com\//;

/** GIPHY adds tracking parameters to media links; the file works without them and the link fits the 300-character column. */
export function cleanMediaUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const clean = `${u.origin}${u.pathname}`;
    return GIPHY_MEDIA.test(clean) && clean.length <= 300 ? clean : null;
  } catch {
    return null;
  }
}

type Rendition = { url?: string; webp?: string; mp4?: string; width?: string | number; height?: string | number };
type RawGif = { id?: string; title?: string; alt_text?: string; images?: Record<string, Rendition | undefined> };

export function normalizeGif(raw: RawGif, kind: GiphyKind): GiphyItem | null {
  const images = raw.images ?? {};
  const full = images.fixed_width;
  const small = images.fixed_width_small ?? full;
  const send = cleanMediaUrl(kind === "gifs" ? full?.mp4 : (full?.webp ?? full?.url));
  const preview = cleanMediaUrl(small?.webp ?? small?.url);
  const still = cleanMediaUrl(images.fixed_width_small_still?.url ?? images.fixed_width_still?.url) ?? preview;
  const width = Number(full?.width);
  const height = Number(full?.height);
  if (!raw.id || !send || !preview || !still || !(width > 0) || !(height > 0)) return null;
  const title = (raw.alt_text || raw.title || "").trim().slice(0, 120);
  return { id: raw.id, title, preview, still, send, width, height };
}
