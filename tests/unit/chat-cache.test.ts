import { describe, expect, it } from "vitest";
import { chatReducer, initialChatState } from "@/lib/messages/store";
import { styleClass } from "@/lib/messages/styles";
import type { MessageRow } from "@/types/app";

const row = (id: string, created_at: string, extra: Partial<MessageRow> = {}): MessageRow => ({
  id,
  conversation_id: "c",
  sender_id: "a",
  content: id,
  message_type: "text",
  image_url: null,
  image_width: null,
  image_height: null,
  reply_to: null,
  created_at,
  delivered_at: null,
  read_at: null,
  ...extra,
});

describe("cached chat", () => {
  it("shows the device copy straight away", () => {
    const s = chatReducer(initialChatState, { type: "cached", rows: [row("1", "2026-01-01T00:01Z")], hasMore: true });
    expect(s.loaded).toBe(true);
    expect(s.fromCache).toBe(true);
    expect(s.messages.map((m) => m.id)).toEqual(["1"]);
  });

  it("is ignored once the server has answered", () => {
    let s = chatReducer(initialChatState, { type: "loaded", rows: [row("2", "2026-01-01T00:02Z")], hasMore: false });
    s = chatReducer(s, { type: "cached", rows: [row("1", "2026-01-01T00:01Z")], hasMore: true });
    expect(s.messages.map((m) => m.id)).toEqual(["2"]);
  });

  it("drops cached rows the server no longer returns, keeps newer live ones", () => {
    let s = chatReducer(initialChatState, {
      type: "cached",
      rows: [row("hidden", "2026-01-01T00:01Z"), row("kept", "2026-01-01T00:02Z")],
      hasMore: false,
    });
    // Realtime delivered a new one while loading.
    s = chatReducer(s, { type: "upsert", rows: [row("live", "2026-01-01T00:09Z")] });
    s = chatReducer(s, { type: "loaded", rows: [row("kept", "2026-01-01T00:02Z", { content: "edited" })], hasMore: false });
    expect(s.fromCache).toBe(false);
    expect(s.messages.map((m) => m.id)).toEqual(["kept", "live"]);
    expect(s.messages[0].content).toBe("edited");
  });

  it("an empty server answer clears the copy", () => {
    let s = chatReducer(initialChatState, { type: "cached", rows: [row("1", "2026-01-01T00:01Z")], hasMore: false });
    s = chatReducer(s, { type: "loaded", rows: [], hasMore: false });
    expect(s.messages).toEqual([]);
  });
});

describe("message styles", () => {
  it("maps known styles and ignores anything else", () => {
    expect(styleClass("script")).toBe("msg-style-script");
    expect(styleClass(null)).toBe("");
    expect(styleClass("<b>")).toBe("");
  });
});
