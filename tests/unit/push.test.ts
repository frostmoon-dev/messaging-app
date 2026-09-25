import { describe, expect, it } from "vitest";
import {
  buildAlertPayload,
  buildPayload,
  buildReactionPayload,
  buildReminderPayload,
  buildSosReplyPayload,
  inQuietHours,
  isGone,
  messagePreview,
  minutesInZone,
  isUuid,
  parseRequest,
  pickSecretKey,
  safeEqual,
} from "@/supabase/functions/send-push/push";
import { urlBase64ToUint8Array } from "@/lib/push";

const ID = "11111111-1111-4111-8111-111111111111";

describe("notification wording", () => {
  it("messages show the name with ♡ and never the message text", () => {
    expect(buildPayload("Ann")).toEqual({ kind: "message", title: "Ann ♡", body: "Sent you a message", url: "/chat", tag: "new-message" });
  });

  it("falls back and trims long names", () => {
    expect(buildPayload(null).title).toBe("Someone ♡");
    expect(buildPayload("   ").title).toBe("Someone ♡");
    expect(buildPayload("x".repeat(80)).title).toBe(`${"x".repeat(40)} ♡`);
  });

  it("reminders say how soon, without needing a time zone", () => {
    const p = buildReminderPayload({ id: ID, title: "Dinner", remind_minutes: 60 });
    expect(p).toMatchObject({ kind: "reminder", title: "♡ Reminder", body: "Dinner starts in 1 hour", url: `/plans?event=${ID}` });
    expect(buildReminderPayload({ id: ID, title: "Trip", remind_minutes: 1440 }).body).toBe("Trip is tomorrow");
    expect(buildReminderPayload({ id: ID, title: "Call", remind_minutes: 0 }).body).toBe("Call is starting now");
  });

  it("SOS is urgent and opens the map at that alert", () => {
    const p = buildAlertPayload({ id: ID, kind: "sos" }, "Ann");
    expect(p.kind).toBe("sos");
    expect(p.title).toBe("SOS · Ann");
    expect(p.url).toBe(`/map?alert=${ID}`);
    expect(p.tag).toBe(`sos-${ID}`);
  });

  it("'Where are you?' opens the share flow", () => {
    expect(buildAlertPayload({ id: ID, kind: "where" }, "Ann")).toMatchObject({ title: "Ann ♡", url: "/map?share=1" });
    expect(buildAlertPayload({ id: ID, kind: "here" }, "Ann")).toMatchObject({ body: "Shared where they are" });
  });
});

describe("send-push request parsing", () => {
  it("accepts exactly one known id", () => {
    expect(parseRequest({ message_id: ID })).toEqual({ kind: "message", id: ID });
    expect(parseRequest({ event_id: ID })).toEqual({ kind: "event", id: ID });
    expect(parseRequest({ alert_id: ID })).toEqual({ kind: "alert", id: ID, repeat: 0 });
    expect(parseRequest({ sos_seen_id: ID })).toEqual({ kind: "sos_seen", id: ID });
    expect(parseRequest({ sos_handled_id: ID })).toEqual({ kind: "sos_handled", id: ID });
    expect(parseRequest({ reaction_message_id: ID, reactor_id: ID })).toEqual({ kind: "reaction", id: ID, reactorId: ID });
    expect(parseRequest({ message_id: ID, alert_id: ID })).toBeNull();
    expect(parseRequest({ message_id: "x" })).toBeNull();
    expect(parseRequest(null)).toBeNull();
  });

  it("needs both ids for a reaction", () => {
    expect(parseRequest({ reaction_message_id: ID })).toBeNull();
    expect(parseRequest({ reaction_message_id: ID, reactor_id: "x" })).toBeNull();
  });

  it("reads the SOS repeat count, ignoring junk", () => {
    expect(parseRequest({ alert_id: ID, repeat: 2 })).toEqual({ kind: "alert", id: ID, repeat: 2 });
    expect(parseRequest({ alert_id: ID, repeat: "2" })).toEqual({ kind: "alert", id: ID, repeat: 0 });
    expect(parseRequest({ alert_id: ID, repeat: 1.5 })).toEqual({ kind: "alert", id: ID, repeat: 0 });
    expect(parseRequest({ alert_id: ID, repeat: 99 })).toEqual({ kind: "alert", id: ID, repeat: 0 });
  });

  it("compares secrets exactly", () => {
    expect(safeEqual("s3cret", "s3cret")).toBe(true);
    expect(safeEqual("s3cret", "s3creT")).toBe(false);
    expect(safeEqual("s3cret", "s3cret!")).toBe(false);
    expect(safeEqual("", "s3cret")).toBe(false);
  });

  it("accepts only uuids", () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid("x")).toBe(false);
    expect(isUuid(42)).toBe(false);
  });

  it("drops addresses the push service says are gone", () => {
    expect(isGone(404)).toBe(true);
    expect(isGone(410)).toBe(true);
    expect(isGone(429)).toBe(false);
    expect(isGone(undefined)).toBe(false);
  });

  it("prefers the new secret key and falls back to the legacy one", () => {
    expect(pickSecretKey('{"default":"sb_secret_new"}', "legacy")).toBe("sb_secret_new");
    expect(pickSecretKey("", "legacy")).toBe("legacy");
    expect(pickSecretKey("not json", "legacy")).toBe("legacy");
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 without padding", () => {
    expect([...urlBase64ToUint8Array("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});

describe("message previews", () => {
  it("show the text, trimmed to one line", () => {
    expect(messagePreview({ message_type: "text", content: "  see you\nat 7  " }, "Rafie")).toBe("see you at 7");
    expect(messagePreview({ message_type: "text", content: "x".repeat(200) }, "Rafie")).toHaveLength(140);
    expect(buildPayload("Ann", "hi").body).toBe("hi");
  });

  it("say exactly what was sent for photos, GIFs and stickers", () => {
    expect(messagePreview({ message_type: "gif", content: "cat" }, "Rafie")).toBe("Rafie sent a GIF.");
    expect(messagePreview({ message_type: "sticker", content: null }, "Rafie")).toBe("Rafie sent a sticker.");
    expect(messagePreview({ message_type: "image", content: null }, "Rafie")).toBe("Rafie sent a photo.");
    expect(messagePreview({ message_type: "image", content: "sunset" }, "Rafie")).toBe("Rafie sent a photo: sunset");
    expect(messagePreview({ message_type: "gif", content: null }, null)).toBe("Someone sent a GIF.");
  });

  it("hide written text, but not the kind of media, when previews are off", () => {
    expect(messagePreview({ message_type: "text", content: "secret" }, "Rafie", false)).toBe("Sent you a message");
    expect(messagePreview({ message_type: "image", content: "secret caption" }, "Rafie", false)).toBe("Rafie sent a photo.");
    expect(messagePreview({ message_type: "gif", content: null }, "Rafie", false)).toBe("Rafie sent a GIF.");
  });
});

describe("reaction pop-ups", () => {
  const text = { id: ID, message_type: "text", content: "dinner at 7?" };

  it("quote your message when previews are on", () => {
    expect(buildReactionPayload(text, "❤️", "Rafie", true)).toEqual({
      kind: "reaction",
      title: "Rafie ♡",
      body: "Rafie reacted ❤️ to “dinner at 7?”.",
      url: `/chat?m=${ID}`,
      tag: `reaction-${ID}`,
    });
  });

  it("don't quote it when previews are off", () => {
    expect(buildReactionPayload(text, "😂", "Rafie", false).body).toBe("Rafie reacted 😂 to your message.");
  });

  it("name the media", () => {
    expect(buildReactionPayload({ id: ID, message_type: "gif", content: null }, "🔥", "Rafie", true).body).toBe("Rafie reacted 🔥 to your GIF.");
    expect(buildReactionPayload({ id: ID, message_type: "image", content: "x" }, "🔥", "Rafie", true).body).toBe("Rafie reacted 🔥 to your photo.");
  });
});

describe("SOS follow-ups", () => {
  it("a repeat says nobody has answered yet", () => {
    expect(buildAlertPayload({ id: ID, kind: "sos" }, "Ann", 1).body).toMatch(/^Still no answer\./);
    expect(buildAlertPayload({ id: ID, kind: "sos" }, "Ann", 1).tag).toBe(`sos-${ID}`);
  });

  it("tells the sender it was seen, then answered, in one pop-up", () => {
    const seen = buildSosReplyPayload({ id: ID }, "seen", "Rafie");
    const handled = buildSosReplyPayload({ id: ID }, "handled", "Rafie");
    expect(seen.body).toBe("Rafie saw your SOS.");
    expect(handled.body).toBe("Rafie is on it.");
    expect(seen.tag).toBe(handled.tag);
    expect(seen.url).toBe(`/map?alert=${ID}`);
  });
});

describe("quiet hours", () => {
  // 2026-01-15 22:30 UTC = 06:30 next day in Manila (UTC+8).
  const at = new Date("2026-01-15T22:30:00Z");

  it("reads the local time in the person's zone", () => {
    expect(minutesInZone(at, "UTC")).toBe(22 * 60 + 30);
    expect(minutesInZone(at, "Asia/Manila")).toBe(6 * 60 + 30);
    expect(minutesInZone(at, null)).toBe(22 * 60 + 30);
    expect(minutesInZone(at, "Not/AZone")).toBeNull();
  });

  it("handles a range over midnight", () => {
    const night = { quiet_start: 23 * 60, quiet_end: 7 * 60 };
    expect(inQuietHours({ ...night, time_zone: "Asia/Manila" }, at)).toBe(true); // 06:30
    expect(inQuietHours({ ...night, time_zone: "UTC" }, at)).toBe(false); // 22:30
    expect(inQuietHours({ ...night, time_zone: "UTC" }, new Date("2026-01-15T23:00:00Z"))).toBe(true);
    expect(inQuietHours({ ...night, time_zone: "UTC" }, new Date("2026-01-15T07:00:00Z"))).toBe(false);
  });

  it("handles a daytime range", () => {
    const work = { quiet_start: 9 * 60, quiet_end: 17 * 60, time_zone: "UTC" };
    expect(inQuietHours(work, new Date("2026-01-15T12:00:00Z"))).toBe(true);
    expect(inQuietHours(work, new Date("2026-01-15T18:00:00Z"))).toBe(false);
  });

  it("is off when unset, equal, or the zone is unknown", () => {
    expect(inQuietHours({ quiet_start: null, quiet_end: null, time_zone: "UTC" }, at)).toBe(false);
    expect(inQuietHours({ quiet_start: 60, quiet_end: 60, time_zone: "UTC" }, at)).toBe(false);
    expect(inQuietHours({ quiet_start: 0, quiet_end: 1439, time_zone: "Not/AZone" }, at)).toBe(false);
  });
});
