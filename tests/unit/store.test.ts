import { describe, expect, it } from "vitest";
import { chatReducer, initialChatState } from "@/lib/messages/store";
import { validateMessageText, MAX_MESSAGE_LENGTH } from "@/lib/messages/validation";
import { activeStatus } from "@/lib/status";
import type { ChatMessage, MessageRow } from "@/types/app";

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

describe("chatReducer", () => {
  it("sorts by time and keeps pending messages last", () => {
    let s = chatReducer(initialChatState, { type: "loaded", rows: [row("2", "2026-01-01T00:02Z"), row("1", "2026-01-01T00:01Z")], hasMore: false });
    const local: ChatMessage = { ...row("p", "2020-01-01T00:00Z"), local: { status: "sending" } };
    s = chatReducer(s, { type: "addLocal", message: local });
    expect(s.messages.map((m) => m.id)).toEqual(["1", "2", "p"]);
  });

  it("replaces an optimistic message with the server row", () => {
    let s = chatReducer(initialChatState, { type: "addLocal", message: { ...row("x", "2026-01-01T00:00Z"), local: { status: "sending" } } });
    s = chatReducer(s, { type: "upsert", rows: [row("x", "2026-01-01T00:00:01Z")] });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].local).toBeUndefined();
  });

  it("never rolls receipts backwards", () => {
    let s = chatReducer(initialChatState, { type: "upsert", rows: [row("x", "2026-01-01T00:00Z", { read_at: "2026-01-01T00:05Z", delivered_at: "2026-01-01T00:04Z" })] });
    s = chatReducer(s, { type: "upsert", rows: [row("x", "2026-01-01T00:00Z")] });
    expect(s.messages[0].read_at).toBe("2026-01-01T00:05Z");
    expect(s.messages[0].delivered_at).toBe("2026-01-01T00:04Z");
  });

  it("marks failures and removes discarded messages", () => {
    let s = chatReducer(initialChatState, { type: "addLocal", message: { ...row("x", "2026-01-01T00:00Z"), local: { status: "sending" } } });
    s = chatReducer(s, { type: "patchLocal", id: "x", local: { status: "failed", error: "nope" } });
    expect(s.messages[0].local?.status).toBe("failed");
    s = chatReducer(s, { type: "remove", id: "x" });
    expect(s.messages).toHaveLength(0);
  });

  it("keeps realtime rows that arrived before the first load finished", () => {
    let s = chatReducer(initialChatState, { type: "upsert", rows: [row("late", "2026-01-01T00:09Z")] });
    s = chatReducer(s, { type: "loaded", rows: [row("1", "2026-01-01T00:01Z")], hasMore: true });
    expect(s.messages.map((m) => m.id)).toEqual(["1", "late"]);
  });
});

describe("validateMessageText", () => {
  it("trims and rejects empty or oversized input", () => {
    expect(validateMessageText("  hi \n")).toEqual({ ok: true, value: "hi" });
    expect(validateMessageText("   ").ok).toBe(false);
    expect(validateMessageText("x".repeat(MAX_MESSAGE_LENGTH + 1)).ok).toBe(false);
  });
});

describe("activeStatus", () => {
  const now = Date.parse("2026-09-24T12:00:00Z");
  const fresh = "2026-09-24T08:00:00Z";

  it("expires after 24 hours", () => {
    expect(activeStatus({ status_emoji: "studying", status_text: "Exams", status_updated_at: fresh }, now)).toEqual({ icon: "studying", text: "Exams" });
    expect(activeStatus({ status_emoji: "studying", status_text: "Exams", status_updated_at: "2026-09-23T08:00:00Z" }, now)).toBeNull();
  });

  it("uses the preset label when there is no text", () => {
    expect(activeStatus({ status_emoji: "out", status_text: null, status_updated_at: fresh }, now)).toEqual({ icon: "out", text: "Out" });
  });

  it("ignores old emoji values", () => {
    expect(activeStatus({ status_emoji: "☕", status_text: "working", status_updated_at: fresh }, now)).toEqual({ icon: null, text: "working" });
    expect(activeStatus({ status_emoji: "☕", status_text: null, status_updated_at: fresh }, now)).toBeNull();
  });
});
