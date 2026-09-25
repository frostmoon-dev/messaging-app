import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDateOnly,
  localDate,
  milestoneOn,
  nextMilestone,
  yearsAgo,
} from "@/supabase/functions/send-push/moments";
import { buildAlertPayload, buildMilestonePayload, buildOnThisDayPayload, parseRequest } from "@/supabase/functions/send-push/push";

const ID = "11111111-1111-4111-8111-111111111111";

describe("anniversaries", () => {
  const since = "2025-03-10";

  it("counts days like the Bond screen: the first day is day 1", () => {
    // Day 100 is 99 days after the start.
    expect(milestoneOn(since, addDays(since, 99))).toEqual({ key: "days:100", label: "100 days" });
    expect(milestoneOn(since, addDays(since, 98))).toBeNull();
    expect(milestoneOn(since, addDays(since, 499))?.key).toBe("days:500");
    expect(milestoneOn(since, addDays(since, 999))).toEqual({ key: "days:1000", label: "1,000 days" });
    expect(milestoneOn(since, addDays(since, 1999))?.key).toBe("days:2000");
  });

  it("marks 1 month, 6 months and every year", () => {
    expect(milestoneOn(since, "2025-04-10")).toEqual({ key: "months:1", label: "1 month" });
    expect(milestoneOn(since, "2025-09-10")).toEqual({ key: "months:6", label: "6 months" });
    expect(milestoneOn(since, "2025-05-10")).toBeNull(); // 2 months: no pop-up
    expect(milestoneOn(since, "2026-03-10")).toEqual({ key: "years:1", label: "1 year" });
    expect(milestoneOn(since, "2028-03-10")).toEqual({ key: "years:3", label: "3 years" });
  });

  it("never fires on or before the first day", () => {
    expect(milestoneOn(since, since)).toBeNull();
    expect(milestoneOn(since, "2024-01-01")).toBeNull();
    expect(milestoneOn("not a date", "2026-03-10")).toBeNull();
  });

  it("moves month-ends and 29 February to the last day that exists", () => {
    expect(milestoneOn("2025-01-31", "2025-02-28")?.key).toBe("months:1");
    expect(milestoneOn("2024-02-29", "2025-02-28")?.key).toBe("years:1");
    expect(milestoneOn("2024-02-29", "2028-02-29")?.key).toBe("years:4");
    expect(milestoneOn("2024-02-29", "2028-02-28")).toBeNull();
  });

  it("finds the next one", () => {
    expect(nextMilestone(since, "2025-03-10")).toMatchObject({ key: "months:1", date: "2025-04-10", daysLeft: 31 });
    expect(nextMilestone(since, "2025-12-01")).toMatchObject({ key: "years:1", date: "2026-03-10", daysLeft: 99 });
  });
});

describe("on this day", () => {
  it("says how long ago", () => {
    expect(yearsAgo("2025-09-25", "2026-09-25")).toBe("1 year ago");
    expect(yearsAgo("2023-09-25", "2026-09-25")).toBe("3 years ago");
  });
});

describe("dates in your time zone", () => {
  it("uses the couple's local date", () => {
    const at = new Date("2026-01-15T22:30:00Z");
    expect(localDate(at, "UTC")).toBe("2026-01-15");
    expect(localDate(at, "Asia/Manila")).toBe("2026-01-16");
    expect(localDate(at, "Not/AZone")).toBe("2026-01-15");
  });

  it("writes dates out in full", () => {
    expect(formatDateOnly("2025-03-10")).toBe("10 March 2025");
  });
});

describe("couple pop-ups", () => {
  it("'Thinking of you' names the sender and replaces itself", () => {
    expect(buildAlertPayload({ id: ID, kind: "love" }, "Rafie")).toEqual({
      kind: "love",
      title: "Rafie ♡",
      body: "Rafie is thinking of you.",
      url: "/chat",
      tag: "love",
    });
  });

  it("anniversaries open the Bond screen", () => {
    const p = buildMilestonePayload({ key: "years:1", label: "1 year" }, "10 March 2025");
    expect(p).toMatchObject({ kind: "moment", title: "1 year together ♡", body: "Since 10 March 2025. Happy anniversary!", url: "/bond" });
    expect(buildMilestonePayload({ key: "days:100", label: "100 days" }, "10 March 2025").body).toBe("Since 10 March 2025. Happy 100 days!");
  });

  it("'On this day' opens the memory", () => {
    const p = buildOnThisDayPayload({ id: ID, title: "Beach day" }, "2 years ago", 1);
    expect(p).toMatchObject({ title: "On this day ♡", body: "2 years ago: Beach day (and 1 more)", url: `/memories?m=${ID}` });
  });

  it("the hourly job asks for moments", () => {
    expect(parseRequest({ moments: true })).toEqual({ kind: "moments" });
    expect(parseRequest({ moments: "yes" })).toBeNull();
  });
});
