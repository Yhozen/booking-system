import { describe, expect, it } from "vitest";

import { addDays, getCalendarDayOffset } from "@/lib/week-date-utils";

describe("week-date-utils", () => {
  it("adds days without mutating the original date", () => {
    const original = new Date("2026-01-01T00:00:00.000Z");
    const shifted = addDays(original, 7);

    expect(shifted.toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(original.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("calculates calendar day offset correctly across DST spring-forward", () => {
    const weekStart = new Date("2024-03-10T00:00:00-05:00");
    const now = new Date("2024-03-11T12:00:00-04:00");

    expect(getCalendarDayOffset(weekStart, now)).toBe(1);
  });

  it("calculates calendar day offset correctly across DST fall-back", () => {
    const weekStart = new Date("2024-11-03T00:00:00-04:00");
    const now = new Date("2024-11-04T12:00:00-05:00");

    expect(getCalendarDayOffset(weekStart, now)).toBe(1);
  });
});
