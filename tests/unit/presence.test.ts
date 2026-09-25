import { describe, expect, it } from "vitest";
import { latestSeen } from "@/lib/presence";
import type { ChatMessage } from "@/types/app";

const m = (sender: string, created: string, read: string | null = null) =>
  ({ id: created, sender_id: sender, created_at: created, read_at: read }) as unknown as ChatMessage;

describe("last seen", () => {
  it("uses the newest proof, not a stale profile value", () => {
    const msgs = [m("me", "2026-09-25T02:00:00Z", "2026-09-25T02:10:00Z"), m("rafie", "2026-09-25T02:16:00Z")];
    expect(latestSeen("2026-09-25T01:26:00Z", null, msgs, "rafie")).toBe("2026-09-25T02:16:00Z");
  });

  it("counts reading your message as being there", () => {
    const msgs = [m("me", "2026-09-25T02:00:00Z", "2026-09-25T02:30:00Z")];
    expect(latestSeen("2026-09-25T01:26:00Z", null, msgs, "rafie")).toBe("2026-09-25T02:30:00Z");
  });

  it("keeps the profile value when it is newest", () => {
    expect(latestSeen("2026-09-25T03:00:00Z", "2026-09-25T02:00:00Z", [], "rafie")).toBe("2026-09-25T03:00:00Z");
  });
});
