import { describe, expect, it } from "vitest";
import { formatDuration, toPeaks } from "@/lib/audio/recorder";
import { buildReactionPayload, messagePreview } from "@/supabase/functions/send-push/push";
import { snippetText } from "@/components/chat/ReplyQuote";

describe("voice waveform", () => {
  it("squeezes loudness into 40 digits, loudest bar = 9", () => {
    const peaks = toPeaks(Array.from({ length: 200 }, (_, i) => (i === 150 ? 0.8 : 0.1)));
    expect(peaks).toHaveLength(40);
    expect(peaks).toMatch(/^[0-9]+$/);
    expect(peaks[30]).toBe("9");
    expect(peaks[0]).toBe("1");
  });

  it("is flat for silence or nothing", () => {
    expect(toPeaks([])).toBe("0".repeat(40));
    expect(toPeaks([0, 0, 0])).toMatch(/^0+$/);
  });

  it("still gives 40 bars for a very short clip", () => {
    expect(toPeaks([0.2, 0.5])).toHaveLength(40);
  });

  it("formats lengths like a phone does", () => {
    expect(formatDuration(7_000)).toBe("0:07");
    expect(formatDuration(84_400)).toBe("1:24");
    expect(formatDuration(-5)).toBe("0:00");
  });
});

describe("voice in pop-ups and replies", () => {
  it("says what it is", () => {
    expect(messagePreview({ message_type: "voice", content: null }, "Rafie")).toBe("Rafie sent a voice message.");
    expect(messagePreview({ message_type: "voice", content: null }, "Rafie", false)).toBe("Rafie sent a voice message.");
    expect(buildReactionPayload({ id: "x", message_type: "voice", content: null }, "❤️", "Rafie", true).body).toBe("Rafie reacted ❤️ to your voice message.");
    expect(snippetText({ id: "x", sender_id: "a", content: null, message_type: "voice", deleted_at: null })).toBe("Voice message");
  });
});
