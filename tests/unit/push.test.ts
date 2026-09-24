import { describe, expect, it } from "vitest";
import { buildPayload, isGone, isUuid, pickSecretKey, safeEqual } from "@/supabase/functions/send-push/push";
import { urlBase64ToUint8Array } from "@/lib/push";

describe("send-push helpers", () => {
  it("never puts message text in the notification", () => {
    expect(buildPayload("Ann")).toEqual({
      title: "NEW MESSAGE",
      body: "Ann sent you a message",
      url: "/chat",
      tag: "new-message",
    });
  });

  it("falls back and trims long names", () => {
    expect(buildPayload(null).body).toBe("Someone sent you a message");
    expect(buildPayload("   ").body).toBe("Someone sent you a message");
    expect(buildPayload("x".repeat(80)).body).toBe(`${"x".repeat(40)} sent you a message`);
  });

  it("compares secrets exactly", () => {
    expect(safeEqual("s3cret", "s3cret")).toBe(true);
    expect(safeEqual("s3cret", "s3creT")).toBe(false);
    expect(safeEqual("s3cret", "s3cret!")).toBe(false);
    expect(safeEqual("", "s3cret")).toBe(false);
  });

  it("accepts only uuids", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
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
