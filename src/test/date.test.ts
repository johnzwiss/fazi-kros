import { describe, expect, it } from "vitest";
import { currentWeekNumber, dateForWorkout, dayKeyForDate, isMondayDate, planEndDate, weekNumberForDate } from "../date";

describe("training dates", () => {
  it("maps weekdays from a Monday start", () => {
    expect(dateForWorkout("2026-03-02", 1, "mon")).toBe("2026-03-02");
    expect(dateForWorkout("2026-03-02", 1, "sun")).toBe("2026-03-08");
    expect(dateForWorkout("2026-03-02", 2, "wed")).toBe("2026-03-11");
  });

  it("keeps calendar dates stable through daylight saving time", () => {
    expect(dateForWorkout("2026-03-02", 2, "sun")).toBe("2026-03-15");
    expect(planEndDate("2026-03-02", 2)).toBe("2026-03-15");
  });

  it("validates Mondays and clamps the displayed week", () => {
    expect(isMondayDate("2026-06-29")).toBe(true);
    expect(isMondayDate("2026-06-30")).toBe(false);
    expect(currentWeekNumber("2026-06-01", 4, new Date("2026-08-01T12:00:00"))).toBe(4);
  });

  it("maps arbitrary plan dates back to their week and weekday", () => {
    expect(weekNumberForDate("2026-06-29", 8, "2026-07-12")).toBe(2);
    expect(dayKeyForDate("2026-07-12")).toBe("sun");
  });
});
