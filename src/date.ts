import { addDays, differenceInCalendarDays, format, isMonday, parseISO } from "date-fns";
import type { DayKey } from "./types";

const DAY_OFFSET: Record<DayKey, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

export function dateForWorkout(startDate: string, weekNumber: number, day: DayKey) {
  return format(addDays(parseISO(startDate), (weekNumber - 1) * 7 + DAY_OFFSET[day]), "yyyy-MM-dd");
}

export function planEndDate(startDate: string, weekCount: number) {
  return format(addDays(parseISO(startDate), weekCount * 7 - 1), "yyyy-MM-dd");
}

export function currentWeekNumber(startDate: string, weekCount: number, today = new Date()) {
  const delta = differenceInCalendarDays(today, parseISO(startDate));
  return Math.min(weekCount, Math.max(1, Math.floor(delta / 7) + 1));
}

export function isMondayDate(value: string) {
  return Boolean(value) && isMonday(parseISO(value));
}

export function prettyDate(value: string, pattern = "MMM d") {
  return format(parseISO(value), pattern);
}

export function mondayOfCurrentWeek() {
  const today = new Date();
  const day = today.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return format(addDays(today, offset), "yyyy-MM-dd");
}
