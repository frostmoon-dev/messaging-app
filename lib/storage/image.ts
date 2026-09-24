import type { Rect } from "./crop";

export const MAX_INPUT_BYTES = 25 * 1024 * 1024; // what we accept from the picker
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches the bucket limit
const MAX_DIMENSION = 1920;

const DIRECT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// HEIC is accepted as *input* when the browser can decode it (Safari); we
// always re-encode, so the bucket only ever receives the types above.
const DECODABLE_TYPES = [...DIRECT_TYPES, "image/heic", "image/heif", "image/avif"];

export type PreparedImage = {
  blob: Blob;
  width: number;
  height: number;
  contentType: string;
  extension: string;
};

export class ImageValidationError extends Error {}

export function validateImageFile(file: File) {
  if (!file.type || !DECODABLE_TYPES.includes(file.type.toLowerCase())) {
    throw new ImageValidationError("That file type isn't supported. Use JPG, PNG, WebP or GIF.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageValidationError("That image is too large (max 25 MB).");
  }
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Fall through to <img> decoding.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageValidationError("Couldn't read that image.");
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** True when any pixel is see-through (PNG cut-outs, stickers). */
function hasTransparency(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

/**
 * WebP where the browser can write it. Safari on iPhone can't, so it falls
 * back to JPEG, or PNG when the image has transparency: JPEG has none and
 * would turn see-through areas black.
 */
async function encode(canvas: HTMLCanvasElement) {
  let blob = await toBlob(canvas, "image/webp", 0.82);
  let contentType = "image/webp";
  let extension = "webp";
  if (!blob || blob.type !== "image/webp") {
    if (hasTransparency(canvas)) {
      blob = await toBlob(canvas, "image/png", 1);
      contentType = "image/png";
      extension = "png";
    } else {
      blob = await toBlob(canvas, "image/jpeg", 0.85);
      contentType = "image/jpeg";
      extension = "jpg";
    }
  }
  if (!blob) throw new ImageValidationError("Couldn't process that image.");
  if (blob.size > MAX_UPLOAD_BYTES) throw new ImageValidationError("That image is still too large after compression.");
  return { blob, contentType, extension };
}

/**
 * Resizes to ≤1920px and re-encodes (WebP, JPEG fallback). Re-encoding also
 * strips EXIF metadata such as GPS location. GIFs are kept as-is so they stay
 * animated.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  validateImageFile(file);
  const decoded = await decode(file);

  try {
    if (file.type === "image/gif") {
      if (file.size > MAX_UPLOAD_BYTES) throw new ImageValidationError("GIFs must be under 10 MB.");
      return { blob: file, width: decoded.width, height: decoded.height, contentType: "image/gif", extension: "gif" };
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageValidationError("Couldn't process that image.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, width, height);

    const { blob, contentType, extension } = await encode(canvas);
    return { blob, width, height, contentType, extension };
  } finally {
    decoded.close();
  }
}

/**
 * Cuts `rect` (in the prepared image's pixels) out of a prepared image and
 * re-encodes it, scaled down so the longer side is at most `maxSide`.
 */
export async function cropImage(image: PreparedImage, rect: Rect, maxSide = MAX_DIMENSION): Promise<PreparedImage> {
  const decoded = await decode(image.blob);
  try {
    const scale = Math.min(1, maxSide / Math.max(rect.width, rect.height));
    const width = Math.max(1, Math.round(rect.width * scale));
    const height = Math.max(1, Math.round(rect.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageValidationError("Couldn't process that image.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
    return { ...(await encode(canvas)), width, height };
  } finally {
    decoded.close();
  }
}
