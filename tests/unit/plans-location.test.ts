import { describe, expect, it } from "vitest";
import { dateKey, monthGrid, reminderLabel, sameDay, timeKey, toStartsAt } from "@/lib/plans";
import { distanceMetres, shouldUpload } from "@/lib/location";

describe("calendar grid", () => {
  it("is 6 weeks starting on Monday and contains the whole month", () => {
    const grid = monthGrid(2026, 8); // September 2026 starts on a Tuesday
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
    expect(dateKey(grid[0])).toBe("2026-08-31");
    expect(dateKey(grid[1])).toBe("2026-09-01");
    expect(grid.filter((d) => d.getMonth() === 8)).toHaveLength(30);
  });

  it("handles a month that starts on Monday", () => {
    expect(dateKey(monthGrid(2026, 5)[0])).toBe("2026-06-01");
  });
});

describe("plan times", () => {
  it("combines the local date and time", () => {
    const d = new Date(toStartsAt("2026-09-24", "18:30", false));
    expect(dateKey(d)).toBe("2026-09-24");
    expect(timeKey(d)).toBe("18:30");
  });

  it("stores all-day plans at 09:00 so reminders come in the morning", () => {
    expect(timeKey(new Date(toStartsAt("2026-09-24", "23:00", true)))).toBe("09:00");
  });

  it("labels reminders", () => {
    expect(reminderLabel(60)).toBe("1 hour before");
    expect(reminderLabel(null)).toBe("No reminder");
    expect(sameDay(new Date(2026, 0, 1, 1), new Date(2026, 0, 1, 23))).toBe(true);
  });
});

describe("location uploads", () => {
  const home = { lat: 3.139, lng: 101.6869, accuracy: 10 };
  const shop = { lat: 3.1399, lng: 101.6869, accuracy: 10 }; // ~100 m north

  it("measures distance", () => {
    expect(Math.round(distanceMetres(home, shop))).toBeGreaterThan(95);
    expect(Math.round(distanceMetres(home, shop))).toBeLessThan(105);
  });

  it("sends the first reading, then only when moved or after a heartbeat", () => {
    const t = 1_000_000;
    expect(shouldUpload(null, home, t)).toBe(true);
    const last = { at: t, pos: home };
    expect(shouldUpload(last, shop, t + 5_000)).toBe(false); // too soon, even if moved
    expect(shouldUpload(last, home, t + 30_000)).toBe(false); // not moved
    expect(shouldUpload(last, shop, t + 30_000)).toBe(true); // moved 100 m
    expect(shouldUpload(last, home, t + 130_000)).toBe(true); // heartbeat
  });
});
