import { Unzip, UnzipInflate } from "fflate";

/**
 * Turns what people have into sticker files, without re-encoding (so animated
 * WebP stickers keep moving):
 * - loose .webp / .png / .gif files,
 * - a WhatsApp chat export (.zip, iPhone: send the stickers to yourself, then
 *   Export chat → Attach media) — only its .webp files are stickers,
 * - a sticker pack (.wastickers, a zip of stickers plus a tray icon and
 *   title/author text files).
 */
export type StickerFile = { name: string; blob: Blob; contentType: string };

export const MAX_IMPORT = 60;
const MAX_BYTES = 2 * 1024 * 1024; // the stickers bucket limit

const TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", gif: "image/gif" };

function extension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

/** Which entries of an archive are stickers. Exports only count .webp (photos are .jpg). */
export function pickStickerEntries(names: string[], kind: "wastickers" | "zip") {
  return names.filter((name) => {
    const base = name.split("/").pop() ?? "";
    if (!base || base.startsWith(".") || name.startsWith("__MACOSX/")) return false;
    const ext = extension(base);
    if (kind === "zip") return ext === "webp";
    // Sticker packs: stickers are .webp (sometimes .png); the tray icon is not a sticker.
    return (ext === "webp" || ext === "png") && !/tray|icon|cover/i.test(base);
  });
}

/** File types seen inside an archive, for a helpful message when it holds no stickers. */
export type ImportReport = { stickers: StickerFile[]; skipped: number; seen: Record<string, number> };

/**
 * Streams through a zip and keeps only the sticker entries, so a WhatsApp
 * chat export full of photos and videos (often hundreds of MB) never has to
 * fit in the phone's memory at once.
 */
async function stickersFromZip(file: File, kind: "zip" | "wastickers", room: number) {
  const found: StickerFile[] = [];
  const seen: Record<string, number> = {};
  let skipped = 0;
  const pending: Promise<void>[] = [];

  const unzip = new Unzip((entry) => {
    const ext = extension(entry.name);
    if (!entry.name.endsWith("/")) seen[ext || "other"] = (seen[ext || "other"] ?? 0) + 1;
    if (!pickStickerEntries([entry.name], kind).length) return;
    if (found.length + pending.length >= room || (entry.originalSize ?? 0) > MAX_BYTES) {
      skipped++;
      return;
    }
    const type = TYPES[ext];
    pending.push(
      new Promise<void>((resolve) => {
        const chunks: Uint8Array[] = [];
        entry.ondata = (err, data, final) => {
          if (err) {
            skipped++;
            resolve();
            return;
          }
          chunks.push(data);
          if (final) {
            found.push({ name: entry.name, blob: new Blob(chunks as BlobPart[], { type }), contentType: type });
            resolve();
          }
        };
        entry.start();
      }),
    );
  });
  unzip.register(UnzipInflate);

  const reader = file.stream().getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      unzip.push(new Uint8Array(0), true);
      break;
    }
    unzip.push(value);
  }
  await Promise.all(pending);
  return { found, skipped, seen };
}

export async function readStickerFiles(files: File[]): Promise<ImportReport> {
  const stickers: StickerFile[] = [];
  const seen: Record<string, number> = {};
  let skipped = 0;
  for (const file of files) {
    const ext = extension(file.name);
    const room = MAX_IMPORT - stickers.length;
    if (ext === "zip" || ext === "wastickers") {
      try {
        const result = await stickersFromZip(file, ext === "zip" ? "zip" : "wastickers", room);
        stickers.push(...result.found);
        skipped += result.skipped;
        for (const [k, n] of Object.entries(result.seen)) seen[k] = (seen[k] ?? 0) + n;
      } catch {
        skipped++;
      }
    } else if (TYPES[ext] && file.size <= MAX_BYTES && room > 0) {
      stickers.push({ name: file.name, blob: file, contentType: TYPES[ext] });
    } else {
      skipped++;
      seen[ext || "other"] = (seen[ext || "other"] ?? 0) + 1;
    }
  }
  return { stickers, skipped, seen };
}

/** "12 .jpg, 3 .mp4, 1 .txt" — what was inside, when nothing could be used. */
export function describeSeen(seen: Record<string, number>) {
  return Object.entries(seen)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([ext, n]) => `${n} .${ext}`)
    .join(", ");
}

/** Width and height, read from the first frame. WhatsApp stickers are 512×512. */
export async function stickerSize(blob: Blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: 512, height: 512 };
  }
}
