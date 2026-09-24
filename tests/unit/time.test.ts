import { describe, expect, it } from "vitest";
import { daysSince, formatDayLabel, formatLastSeen, isSameDay } from "@/lib/time";
import { toRoman } from "@/lib/roman";

const now = new Date(2026, 8, 24, 18, 0); // 24 Sep 2026, 18:00 local

describe("time helpers", () => {
  it("labels days", () => {
    expect(formatDayLabel(new Date(2026, 8, 24, 9, 0), now)).toBe("Today");
    expect(formatDayLabel(new Date(2026, 8, 23, 23, 59), now)).toBe("Yesterday");
  });
  it("formats last seen", () => {
    expect(formatLastSeen(null, now)).toBe("Offline");
    expect(formatLastSeen(new Date(2026, 8, 24, 17, 42).toISOString(), now)).toMatch(/^Last seen 17:42$/);
    expect(formatLastSeen(new Date(2026, 8, 23, 23, 10).toISOString(), now)).toMatch(/^Last seen yesterday/);
  });
  it("counts days together including the first day", () => {
    expect(daysSince("2026-09-24", now)).toBe(1);
    expect(daysSince("2026-09-14", now)).toBe(11);
  });
  it("compares days", () => {
    expect(isSameDay(new Date(2026, 0, 1, 1), new Date(2026, 0, 1, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 0, 1), new Date(2026, 0, 2))).toBe(false);
  });
});

describe("toRoman", () => {
  it("converts levels", () => {
    expect(toRoman(7)).toBe("VII");
    expect(toRoman(49)).toBe("XLIX");
    expect(toRoman(99)).toBe("XCIX");
    expect(toRoman(0)).toBe("—");
  });
});
