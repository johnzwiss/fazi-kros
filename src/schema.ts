import { z } from "zod";

const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Exercise name is required").max(120),
  prescription: z.string().trim().min(1, "Prescription is required").max(120),
});

const workoutSchema = z
  .object({
    day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    type: z.enum(["running", "strength", "mobility", "cross_training", "other"]),
    title: z.string().trim().min(1, "Workout title is required").max(140),
    instructions: z.string().trim().max(2000).optional(),
    plannedMiles: z.number().finite().positive().max(200).optional(),
    plannedMinutes: z.number().int().positive().max(1440).optional(),
    exercises: z.array(exerciseSchema).max(40).optional(),
  })
  .superRefine((workout, ctx) => {
    if (workout.type === "running" && workout.plannedMiles == null && workout.plannedMinutes == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A running workout needs plannedMiles or plannedMinutes",
        path: ["plannedMiles"],
      });
    }
  });

const weekSchema = z.object({
  weekNumber: z.number().int().min(1).max(104),
  summary: z.string().trim().max(500).optional(),
  workouts: z.array(workoutSchema).min(1, "Add at least one workout").max(80),
});

export const planTemplateSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().trim().min(1, "Plan title is required").max(160),
    description: z.string().trim().min(1, "Plan description is required").max(2000),
    guidance: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    weeks: z.array(weekSchema).min(1, "Add at least one week").max(52),
  })
  .superRefine((plan, ctx) => {
    const weekNumbers = plan.weeks.map((week) => week.weekNumber);
    if (new Set(weekNumbers).size !== weekNumbers.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Week numbers must be unique", path: ["weeks"] });
    }
    const sorted = [...weekNumbers].sort((a, b) => a - b);
    if (sorted.some((week, index) => week !== index + 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Weeks must be numbered consecutively starting at 1",
        path: ["weeks"],
      });
    }
    const count = plan.weeks.reduce((sum, week) => sum + week.workouts.length, 0);
    if (count > 450) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A plan may contain at most 450 workouts", path: ["weeks"] });
    }
  });

export type PlanTemplateInput = z.infer<typeof planTemplateSchema>;

export function parsePlanJson(value: string) {
  try {
    return planTemplateSchema.safeParse(JSON.parse(value));
  } catch (error) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: [],
          message: error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON",
        },
      ]),
    };
  }
}

export function formatValidationErrors(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.length ? issue.path.join(".") : "plan"}: ${issue.message}`);
}
