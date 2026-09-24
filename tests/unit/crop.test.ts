import { describe, expect, it } from "vitest";
import { CENTERED, clampCrop, cropRect, cropSize, panCrop } from "@/lib/storage/crop";

describe("photo crop", () => {
  it("keeps the whole photo for its own shape at zoom 1", () => {
    expect(cropRect(CENTERED, 1600, 1200, 1600 / 1200)).toEqual({ x: 0, y: 0, width: 1600, height: 1200 });
  });

  it("takes the largest centred square from a landscape photo", () => {
    expect(cropRect(CENTERED, 1600, 1200, 1)).toEqual({ x: 200, y: 0, width: 1200, height: 1200 });
  });

  it("takes the largest 4:5 area from a portrait photo", () => {
    const size = cropSize(1000, 2000, 4 / 5, 1);
    expect(size.width).toBe(1000);
    expect(size.height).toBe(1250);
  });

  it("zooming makes the area smaller", () => {
    expect(cropRect({ zoom: 2, cx: 0.5, cy: 0.5 }, 1600, 1200, 1)).toEqual({ x: 500, y: 300, width: 600, height: 600 });
  });

  it("never leaves the photo", () => {
    const c = clampCrop({ zoom: 9, cx: -1, cy: 5 }, 1600, 1200, 1);
    expect(c.zoom).toBe(4);
    const r = cropRect(c, 1600, 1200, 1);
    expect(r.x).toBe(0);
    expect(r.y + r.height).toBe(1200);
  });

  it("dragging right shows more of the left side", () => {
    const moved = panCrop(CENTERED, 50, 0, 300, 1600, 1200, 1);
    expect(moved.cx).toBeLessThan(0.5);
    expect(moved.cy).toBe(0.5); // no room to move vertically at zoom 1
  });
});
