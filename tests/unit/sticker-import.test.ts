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
