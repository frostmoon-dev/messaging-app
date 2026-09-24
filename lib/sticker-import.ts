import { unzipSync } from "fflate";

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

export async function readStickerFiles(files: File[]): Promise<{ stickers: StickerFile[]; skipped: number }> {
  const stickers: StickerFile[] = [];
  let skipped = 0;
  for (const file of files) {
    const ext = extension(file.name);
    if (ext === "zip" || ext === "wastickers") {
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
      } catch {
        skipped++;
        continue;
      }
      for (const name of pickStickerEntries(Object.keys(entries), ext === "zip" ? "zip" : "wastickers")) {
        const bytes = entries[name];
        const type = TYPES[extension(name)];
        if (bytes.byteLength > MAX_BYTES) {
          skipped++;
          continue;
        }
        stickers.push({ name, blob: new Blob([bytes as BlobPart], { type }), contentType: type });
      }
    } else if (TYPES[ext] && file.size <= MAX_BYTES) {
      stickers.push({ name: file.name, blob: file, contentType: TYPES[ext] });
    } else {
      skipped++;
    }
  }
  if (stickers.length > MAX_IMPORT) {
    skipped += stickers.length - MAX_IMPORT;
    stickers.length = MAX_IMPORT;
  }
  return { stickers, skipped };
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
