import { describe, expect, it } from "vitest";
import { initials, isEmojiOnly, tokenize } from "@/lib/text";

describe("isEmojiOnly", () => {
  it("detects 1–3 emoji", () => {
    expect(isEmojiOnly("❤️")).toBe(true);
    expect(isEmojiOnly("😂😂")).toBe(true);
    expect(isEmojiOnly(" 👍 ")).toBe(true);
  });
  it("rejects text, digits and long runs", () => {
    expect(isEmojiOnly("ok ❤️")).toBe(false);
    expect(isEmojiOnly("1")).toBe(false);
    expect(isEmojiOnly("😂😂😂😂")).toBe(false);
    expect(isEmojiOnly("")).toBe(false);
    expect(isEmojiOnly(null)).toBe(false);
  });
});

describe("tokenize", () => {
  it("keeps plain text as text", () => {
    expect(tokenize("hello <b>there</b>")).toEqual([{ type: "text", value: "hello <b>there</b>" }]);
  });
  it("links only http(s) URLs and trims trailing punctuation", () => {
    const tokens = tokenize("look https://example.com/a?b=1. ok");
    expect(tokens).toEqual([
      { type: "text", value: "look " },
      { type: "link", value: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { type: "text", value: ". ok" },
    ]);
  });
  it("never turns javascript: into a link", () => {
    expect(tokenize("javascript:alert(1)").every((t) => t.type === "text")).toBe(true);
  });
});

describe("initials", () => {
  it("uses the first letters", () => {
    expect(initials("Ren Amamiya")).toBe("RA");
    expect(initials("shiru")).toBe("SH");
  });
});
