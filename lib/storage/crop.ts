/**
 * Crop maths for the photo cropper. Everything is in the image's own pixels,
 * so it doesn't depend on how big the crop frame is on screen.
 *
 * A crop is a zoom (1 = the largest frame-shaped area that fits the image)
 * and the centre of that area, as a fraction of the image (0–1).
 */
export type Crop = { zoom: number; cx: number; cy: number };
export type Rect = { x: number; y: number; width: number; height: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export const CENTERED: Crop = { zoom: 1, cx: 0.5, cy: 0.5 };

/** Size of the cropped area in image pixels for a frame of `aspect` (width / height). */
export function cropSize(width: number, height: number, aspect: number, zoom: number) {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  if (width / height > aspect) {
    const h = height / z;
    return { width: h * aspect, height: h };
  }
  const w = width / z;
  return { width: w, height: w / aspect };
}

/** Keeps the zoom in range and the frame inside the image. */
export function clampCrop(crop: Crop, width: number, height: number, aspect: number): Crop {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, crop.zoom));
  const size = cropSize(width, height, aspect, zoom);
  const halfX = size.width / 2 / width;
  const halfY = size.height / 2 / height;
  return {
    zoom,
    cx: Math.min(1 - halfX, Math.max(halfX, crop.cx)),
    cy: Math.min(1 - halfY, Math.max(halfY, crop.cy)),
  };
}

/** The area to cut out, in whole image pixels. */
export function cropRect(crop: Crop, width: number, height: number, aspect: number): Rect {
  const c = clampCrop(crop, width, height, aspect);
  const size = cropSize(width, height, aspect, c.zoom);
  const w = Math.max(1, Math.min(width, Math.round(size.width)));
  const h = Math.max(1, Math.min(height, Math.round(size.height)));
  const x = Math.min(width - w, Math.max(0, Math.round(c.cx * width - w / 2)));
  const y = Math.min(height - h, Math.max(0, Math.round(c.cy * height - h / 2)));
  return { x, y, width: w, height: h };
}

/** Moves the crop by a drag of (dx, dy) screen pixels in a frame `frameWidth` wide. */
export function panCrop(crop: Crop, dx: number, dy: number, frameWidth: number, width: number, height: number, aspect: number): Crop {
  const size = cropSize(width, height, aspect, crop.zoom);
  const imagePxPerScreenPx = size.width / frameWidth;
  return clampCrop(
    { zoom: crop.zoom, cx: crop.cx - (dx * imagePxPerScreenPx) / width, cy: crop.cy - (dy * imagePxPerScreenPx) / height },
    width,
    height,
    aspect,
  );
}
