import { isMatch, isValid, parseISO } from "date-fns";

export type CalendarView = "day" | "week" | "month";

export interface TrainingDeepLink {
  planId: string;
  date: string;
  view: CalendarView;
}

export function validTrainingDate(value: string) {
  return isMatch(value, "yyyy-MM-dd") && isValid(parseISO(value));
}

export function parseTrainingDeepLink(search: string): TrainingDeepLink | null {
  const params = new URLSearchParams(search);
  const planId = params.get("plan")?.trim() || "";
  const date = params.get("date")?.trim() || "";
  const requestedView = params.get("view");
  if (!planId && !date) return null;
  if (!planId || !validTrainingDate(date)) throw new Error("That training link is incomplete or invalid");
  const view: CalendarView = requestedView === "week" || requestedView === "month" || requestedView === "day" ? requestedView : "day";
  return { planId, date, view };
}

export function buildTrainingUrl(baseUrl: string, link: TrainingDeepLink) {
  const url = new URL(baseUrl);
  url.searchParams.set("plan", link.planId);
  url.searchParams.set("date", link.date);
  url.searchParams.set("view", link.view);
  return url.toString();
}

export function clearTrainingUrl(urlValue: string) {
  const url = new URL(urlValue);
  url.searchParams.delete("plan");
  url.searchParams.delete("date");
  url.searchParams.delete("view");
  return url.toString();
}
