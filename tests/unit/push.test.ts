import { describe, expect, it } from "vitest";
import {
  buildAlertPayload,
  buildPayload,
  buildReminderPayload,
  isGone,
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
    expect(parseRequest({ alert_id: ID })).toEqual({ kind: "alert", id: ID });
    expect(parseRequest({ message_id: ID, alert_id: ID })).toBeNull();
    expect(parseRequest({ message_id: "x" })).toBeNull();
    expect(parseRequest(null)).toBeNull();
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
  it("show the text, trimmed to one line", async () => {
    const { messagePreview, buildPayload } = await import("../../supabase/functions/send-push/push");
    expect(messagePreview({ message_type: "text", content: "  see you\nat 7  " })).toBe("see you at 7");
    expect(messagePreview({ message_type: "text", content: "x".repeat(200) })).toHaveLength(140);
    expect(messagePreview({ message_type: "image", content: null })).toBe("Sent a photo");
    expect(messagePreview({ message_type: "image", content: "sunset" })).toBe("Photo: sunset");
    expect(messagePreview({ message_type: "sticker", content: null })).toBe("Sent a sticker");
    expect(messagePreview({ message_type: "gif", content: "cat" })).toBe("Sent a GIF");
    expect(buildPayload("Ann", "hi").body).toBe("hi");
  });
});
