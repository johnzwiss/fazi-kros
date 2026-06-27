import { describe, expect, it } from "vitest";
import { applyDelta, mileageForWorkout, planProgress, statDelta } from "../stats";
import { EMPTY_STATS, type UserWorkout } from "../types";

const run: UserWorkout = {
  id: "run",
  weekNumber: 1,
  scheduledDate: "2026-06-29",
  day: "mon",
  type: "running",
  title: "Easy run",
  plannedMiles: 4,
  completed: false,
};

describe("training statistics", () => {
  it("uses actual mileage when supplied", () => {
    expect(mileageForWorkout({ ...run, actualMiles: 4.3 })).toBe(4.3);
  });

  it("adds and reverses completion totals", () => {
    const completed = applyDelta(EMPTY_STATS, statDelta(run, true));
    expect(completed).toMatchObject({ workoutsCompleted: 1, runsCompleted: 1, milesRun: 4 });
    expect(applyDelta(completed, statDelta(run, false))).toEqual(EMPTY_STATS);
  });

  it("calculates rounded plan progress", () => {
    expect(planProgress({ completedWorkouts: 2, totalWorkouts: 3 })).toBe(67);
  });
});
