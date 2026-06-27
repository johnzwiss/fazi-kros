import { describe, expect, it } from "vitest";
import { parsePlanJson, planTemplateSchema } from "../schema";
import baseBuildingPlan from "../../public/examples/base-building-plan.json";

const plan = {
  schemaVersion: 1,
  title: "Run and lift",
  description: "A compact mixed plan",
  guidance: ["Keep easy days easy"],
  weeks: [{
    weekNumber: 1,
    workouts: [
      { day: "mon", type: "running", title: "Easy run", plannedMiles: 4 },
      { day: "mon", type: "strength", title: "Lift", exercises: [{ name: "Squat", prescription: "3 x 8" }] },
    ],
  }],
};

describe("planTemplateSchema", () => {
  it("accepts running and strength on the same day", () => {
    expect(planTemplateSchema.safeParse(plan).success).toBe(true);
  });

  it("requires running distance or duration", () => {
    const invalid = structuredClone(plan);
    delete (invalid.weeks[0].workouts[0] as { plannedMiles?: number }).plannedMiles;
    const result = planTemplateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain("plannedMiles");
  });

  it("requires consecutive unique weeks", () => {
    const invalid = { ...plan, weeks: [{ ...plan.weeks[0], weekNumber: 2 }] };
    expect(planTemplateSchema.safeParse(invalid).success).toBe(false);
  });

  it("returns a useful error for malformed JSON", () => {
    const result = parsePlanJson("{ nope }");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain("Invalid JSON");
  });

  it("validates the complete imported reference plan", () => {
    const result = planTemplateSchema.safeParse(baseBuildingPlan);
    expect(result.success).toBe(true);
    expect(baseBuildingPlan.weeks).toHaveLength(8);
    expect(baseBuildingPlan.weeks.flatMap((week) => week.workouts)).toHaveLength(64);
  });
});
