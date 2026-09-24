import { describe, expect, it } from "vitest";
import { pickStickerEntries } from "@/lib/sticker-import";

describe("sticker import", () => {
  it("takes only the stickers from a WhatsApp chat export", () => {
    const names = [
      "WhatsApp Chat - Rafie/_chat.txt",
      "WhatsApp Chat - Rafie/00000012-PHOTO-2026-09-20.jpg",
      "WhatsApp Chat - Rafie/00000013-STICKER-2026-09-20.webp",
      "__MACOSX/._00000013-STICKER.webp",
    ];
    expect(pickStickerEntries(names, "zip")).toEqual(["WhatsApp Chat - Rafie/00000013-STICKER-2026-09-20.webp"]);
  });

  it("takes stickers but not the tray icon or text from a sticker pack", () => {
    const names = ["title.txt", "author.txt", "tray.png", "1.webp", "2.webp", "3.png"];
    expect(pickStickerEntries(names, "wastickers")).toEqual(["1.webp", "2.webp", "3.png"]);
  });
});

describe("reading archives", () => {
  it("streams stickers out of a WhatsApp export and reports what else was there", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const { readStickerFiles, describeSeen } = await import("@/lib/sticker-import");
    const zip = zipSync({
      "WhatsApp Chat - Rafie/_chat.txt": strToU8("hi"),
      "WhatsApp Chat - Rafie/00000001-PHOTO.jpg": new Uint8Array(2000).fill(7),
      "WhatsApp Chat - Rafie/00000002-STICKER.webp": new Uint8Array(3000).fill(1),
      "WhatsApp Chat - Rafie/00000003-STICKER.webp": new Uint8Array(10).fill(2),
    });
    const report = await readStickerFiles([new File([zip as BlobPart], "WhatsApp Chat - Rafie.zip")]);
    expect(report.stickers.map((s) => s.name.split("/").pop())).toEqual(["00000002-STICKER.webp", "00000003-STICKER.webp"]);
    expect(report.stickers[0].blob.size).toBe(3000);
    expect(report.stickers[0].contentType).toBe("image/webp");
    expect(describeSeen(report.seen)).toContain("2 .webp");
  });

  it("explains a zip with no stickers", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const { readStickerFiles, describeSeen } = await import("@/lib/sticker-import");
    const zip = zipSync({ "a.jpg": new Uint8Array(10), "b.jpg": new Uint8Array(10), "_chat.txt": strToU8("x") });
    const report = await readStickerFiles([new File([zip as BlobPart], "chat.zip")]);
    expect(report.stickers).toHaveLength(0);
    expect(describeSeen(report.seen)).toBe("2 .jpg, 1 .txt");
  });
});
