import type { UserPlan, UserStats, UserWorkout } from "./types";

export function mileageForWorkout(workout: Pick<UserWorkout, "type" | "plannedMiles" | "actualMiles">) {
  return workout.type === "running" ? (workout.actualMiles ?? workout.plannedMiles ?? 0) : 0;
}

export function statDelta(workout: UserWorkout, completing: boolean): Omit<UserStats, "plansCompleted"> {
  const direction = completing ? 1 : -1;
  return {
    workoutsCompleted: direction,
    runsCompleted: workout.type === "running" ? direction : 0,
    strengthWorkoutsCompleted: workout.type === "strength" ? direction : 0,
    milesRun: direction * mileageForWorkout(workout),
  };
}

export function applyDelta(stats: UserStats, delta: Partial<UserStats>): UserStats {
  return {
    workoutsCompleted: Math.max(0, stats.workoutsCompleted + (delta.workoutsCompleted ?? 0)),
    runsCompleted: Math.max(0, stats.runsCompleted + (delta.runsCompleted ?? 0)),
    strengthWorkoutsCompleted: Math.max(0, stats.strengthWorkoutsCompleted + (delta.strengthWorkoutsCompleted ?? 0)),
    milesRun: Math.max(0, Number((stats.milesRun + (delta.milesRun ?? 0)).toFixed(2))),
    plansCompleted: Math.max(0, stats.plansCompleted + (delta.plansCompleted ?? 0)),
  };
}

export function planProgress(plan: Pick<UserPlan, "completedWorkouts" | "totalWorkouts">) {
  return plan.totalWorkouts ? Math.round((plan.completedWorkouts / plan.totalWorkouts) * 100) : 0;
}
