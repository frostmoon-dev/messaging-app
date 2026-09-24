import { describe, expect, it } from "vitest";
import { friendlyError, MESSAGES } from "@/lib/errors";

describe("friendly errors", () => {
  it("says when the database is missing an update", () => {
    const oldCheck = { code: "23514", message: 'new row for relation "messages" violates check constraint "messages_body_check"' };
    expect(friendlyError(oldCheck, "send")).toBe(MESSAGES.needsUpdate);
    expect(friendlyError({ code: "PGRST205", message: "Could not find the table 'public.stickers'" }, "load")).toBe(MESSAGES.needsUpdate);
    expect(friendlyError({ code: "PGRST202", message: "Could not find the function public.delete_message" }, "save")).toBe(MESSAGES.needsUpdate);
  });

  it("keeps the normal message otherwise", () => {
    expect(friendlyError({ code: "23514", message: "violates check constraint \"events_title_check\"" }, "save")).toBe(MESSAGES.save);
    expect(friendlyError({ code: "P0429" }, "send")).toBe(MESSAGES.rateLimited);
  });
});
