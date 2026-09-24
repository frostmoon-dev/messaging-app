import { describe, expect, it } from "vitest";
import { MAX_DIM, MIN_DIM, parseChatBackground } from "@/lib/chat-background";

describe("chat background", () => {
  it("reads patterns and photos", () => {
    expect(parseChatBackground('{"kind":"pattern","pattern":"dots"}')).toEqual({ kind: "pattern", pattern: "dots" });
    expect(parseChatBackground('{"kind":"photo","src":"data:image/webp;base64,AAAA","dim":0.5}')).toEqual({
      kind: "photo",
      src: "data:image/webp;base64,AAAA",
      dim: 0.5,
    });
  });

  it("keeps the dim in range so text stays readable", () => {
    expect(parseChatBackground('{"kind":"photo","src":"data:image/png;base64,A","dim":0}')).toMatchObject({ dim: MIN_DIM });
    expect(parseChatBackground('{"kind":"photo","src":"data:image/png;base64,A","dim":1}')).toMatchObject({ dim: MAX_DIM });
  });

  it("falls back to plain for anything else", () => {
    expect(parseChatBackground(null)).toEqual({ kind: "none" });
    expect(parseChatBackground("not json")).toEqual({ kind: "none" });
    expect(parseChatBackground('{"kind":"pattern","pattern":"mooncell"}')).toEqual({ kind: "none" });
    // Only local data URLs: never load a background from another site.
    expect(parseChatBackground('{"kind":"photo","src":"https://example.com/a.jpg"}')).toEqual({ kind: "none" });
  });
});
