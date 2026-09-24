import { describe, expect, it } from "vitest";
import { dayPart, moonAge, moonPhaseName } from "@/lib/calendar";

const at = (h: number, m = 0) => new Date(2026, 8, 24, h, m);

describe("dayPart", () => {
  it("maps hours to the in-game time of day", () => {
    expect(dayPart(at(0, 30)).id).toBe("lateatnight");
    expect(dayPart(at(4, 59)).id).toBe("lateatnight");
    expect(dayPart(at(5)).id).toBe("morning");
    expect(dayPart(at(11)).id).toBe("daytime");
    expect(dayPart(at(12, 30)).id).toBe("lunchtime");
    expect(dayPart(at(15)).id).toBe("afternoon");
    expect(dayPart(at(20)).id).toBe("nighttime");
    expect(dayPart(at(23, 15)).id).toBe("lateatnight");
  });
});

describe("moon phase", () => {
  it("matches known new and full moons", () => {
    // New moon 11 Jan 2024 11:57 UTC, full moon 25 Jan 2024 17:54 UTC.
    expect(moonPhaseName(moonAge(new Date(Date.UTC(2024, 0, 11, 12))))).toBe("New moon");
    expect(moonPhaseName(moonAge(new Date(Date.UTC(2024, 0, 25, 18))))).toBe("Full moon");
    expect(moonPhaseName(moonAge(new Date(Date.UTC(2024, 0, 18, 3))))).toBe("First quarter");
  });

  it("stays within one cycle", () => {
    const age = moonAge(new Date(Date.UTC(1990, 5, 1)));
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(1);
  });
});
