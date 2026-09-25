import { describe, expect, it } from "vitest";
import { effectLabel, graphemes, isMessageEffect, LETTER_EFFECTS } from "@/lib/messages/effects";
import { messagePreview } from "@/supabase/functions/send-push/push";

describe("send effects", () => {
  it("knows its effects and nothing else", () => {
    expect(isMessageEffect("slam")).toBe(true);
    expect(isMessageEffect("heartbeat")).toBe(true);
    expect(isMessageEffect("confetti")).toBe(false);
    expect(isMessageEffect(null)).toBe(false);
    expect(effectLabel("ink")).toBe("Invisible ink");
    expect(effectLabel("nope")).toBeNull();
  });

  it("animates letters only for Shake, Ripple and Bloom", () => {
    expect([...LETTER_EFFECTS].sort()).toEqual(["bloom", "ripple", "shake"]);
  });

  it("keeps emoji whole when splitting letters", () => {
    expect(graphemes("hi❤️")).toEqual(["h", "i", "❤️"]);
    expect(graphemes("👩‍❤️‍👨!")).toEqual(["👩‍❤️‍👨", "!"]);
  });
});

describe("effects in pop-ups", () => {
  it("names the effect after the text, like iMessage", () => {
    expect(messagePreview({ message_type: "text", content: "I got the job", effect: "slam" }, "Rafie")).toBe("I got the job (sent with Slam)");
  });

  it("never shows invisible ink on the lock screen", () => {
    expect(messagePreview({ message_type: "text", content: "secret", effect: "ink" }, "Rafie")).toBe("Rafie sent a message with invisible ink.");
  });

  it("hides the text but not the privacy rule when previews are off", () => {
    expect(messagePreview({ message_type: "text", content: "hi", effect: "slam" }, "Rafie", false)).toBe("Sent you a message");
    expect(messagePreview({ message_type: "text", content: "hi", effect: null }, "Rafie")).toBe("hi");
  });
});
