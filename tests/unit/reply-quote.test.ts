import { describe, expect, it } from "vitest";
import { snippetText } from "@/components/chat/ReplyQuote";

describe("reply previews", () => {
  it("say when the original was deleted", () => {
    expect(snippetText({ id: "1", sender_id: "a", content: null, message_type: "text", deleted_at: "2026-01-01T00:00Z" })).toBe("Deleted message");
    expect(snippetText({ id: "1", sender_id: "a", content: null, message_type: "gif", deleted_at: null })).toBe("GIF");
    expect(snippetText(undefined)).toBe("Original message");
  });
});
