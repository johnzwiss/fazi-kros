import type { Timestamp } from "firebase/firestore";

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAYS)[number];
export type WorkoutType = "running" | "strength" | "mobility" | "cross_training" | "other";

export interface Exercise {
  name: string;
  prescription: string;
}

export interface TemplateWorkout {
  day: DayKey;
  type: WorkoutType;
  title: string;
  instructions?: string;
  plannedMiles?: number;
  plannedMinutes?: number;
  exercises?: Exercise[];
}

export interface TemplateWeek {
  weekNumber: number;
  summary?: string;
  workouts: TemplateWorkout[];
}

export interface PlanTemplate {
  id?: string;
  schemaVersion: 1;
  title: string;
  description: string;
  guidance: string[];
  weeks: TemplateWeek[];
  status?: "published" | "archived";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserStats {
  workoutsCompleted: number;
  runsCompleted: number;
  strengthWorkoutsCompleted: number;
  milesRun: number;
  plansCompleted: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  bio: string;
  trainingGoals: string;
  shareStats: boolean;
  activePlanId?: string | null;
  stats: UserStats;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserPlan {
  id: string;
  sourceTemplateId: string;
  title: string;
  description: string;
  guidance: string[];
  startDate: string;
  endDate: string;
  weekCount: number;
  status: "active" | "completed" | "archived";
  totalWorkouts: number;
  completedWorkouts: number;
  plannedMiles: number;
  completedMiles: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserWorkout extends TemplateWorkout {
  id: string;
  weekNumber: number;
  scheduledDate: string;
  completed: boolean;
  actualMiles?: number;
  completedAt?: Timestamp | null;
}

export interface SharedProfile {
  email: string;
  displayName: string;
  photoUrl?: string;
  bio: string;
  trainingGoals: string;
  stats: UserStats;
  updatedAt?: Timestamp;
}

export const EMPTY_STATS: UserStats = {
  workoutsCompleted: 0,
  runsCompleted: 0,
  strengthWorkoutsCompleted: 0,
  milesRun: 0,
  plansCompleted: 0,
};
