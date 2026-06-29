import { addDays, format, parseISO } from "date-fns";
import { buildTrainingUrl } from "./deepLink";
import type { Chore, UserPlan, UserWorkout } from "./types";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export const GOOGLE_CALENDAR_NAME = "Training Plan Tracker";
export const HOME_GOOGLE_CALENDAR_NAME = "Daybook — Home";
const API_ROOT = "https://www.googleapis.com/calendar/v3";

interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  start?: { date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

interface EventListResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}

export interface CalendarWorkoutUpdate {
  workoutId: string;
  eventId: string;
  fingerprint: string;
}

export interface CalendarSyncResult {
  calendarId: string;
  calendarName: string;
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
  failed: number;
  workoutUpdates: CalendarWorkoutUpdate[];
}

export class GoogleCalendarError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type Fetcher = typeof fetch;

async function calendarRequest<T>(token: string, path: string, init: RequestInit = {}, fetcher: Fetcher = fetch): Promise<T> {
  const response = await fetcher(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    let message = `Google Calendar request failed (${response.status})`;
    try {
      const payload = await response.json() as { error?: { message?: string } };
      if (payload.error?.message) message = payload.error.message;
    } catch {
      // Keep the useful status-based fallback.
    }
    throw new GoogleCalendarError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function workoutTypeLabel(workout: UserWorkout) {
  return ({ running: "Run", strength: "Strength", mobility: "Mobility", cross_training: "Cross-training", other: "Workout" } as const)[workout.type];
}

export function calendarEventForWorkout(plan: UserPlan, workout: UserWorkout, appBaseUrl: string) {
  const link = buildTrainingUrl(appBaseUrl, { planId: plan.id, date: workout.scheduledDate, view: "day" });
  const details = [
    plan.title,
    workout.plannedMiles != null ? `Planned distance: ${workout.plannedMiles} miles` : "",
    workout.plannedMinutes != null ? `Planned duration: ${workout.plannedMinutes} minutes` : "",
    workout.completed && workout.type === "running" && workout.actualMiles != null ? `Completed distance: ${workout.actualMiles} miles` : "",
    workout.instructions || "",
    ...(workout.exercises?.map((exercise) => `${exercise.name}: ${exercise.prescription}`) || []),
    "",
    `Open this day in Training Plan Tracker: ${link}`,
  ].filter((line, index, lines) => line || (index > 0 && lines[index - 1]));

  return {
    summary: `${workout.completed ? "✓ " : ""}${workoutTypeLabel(workout)} — ${workout.title}`,
    description: details.join("\n"),
    start: { date: workout.scheduledDate },
    end: { date: format(addDays(parseISO(workout.scheduledDate), 1), "yyyy-MM-dd") },
    transparency: "transparent",
    reminders: { useDefault: true },
    source: { title: "Open in Training Plan Tracker", url: link },
    extendedProperties: {
      private: {
        app: "training-plan-tracker",
        planId: plan.id,
        workoutId: workout.id,
      },
    },
  };
}

export function fingerprintCalendarEvent(event: unknown) {
  const input = JSON.stringify(event);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

async function createCalendar(token: string, calendarName: string, fetcher: Fetcher) {
  const created = await calendarRequest<{ id: string }>(token, "/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: calendarName, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }),
  }, fetcher);
  return created.id;
}

async function ensureCalendar(token: string, calendarId: string | undefined, calendarName: string, fetcher: Fetcher) {
  if (calendarId) {
    try {
      await calendarRequest(token, `/calendars/${encodeURIComponent(calendarId)}`, {}, fetcher);
      return { calendarId, newlyCreated: false };
    } catch (error) {
      if (!(error instanceof GoogleCalendarError) || error.status !== 404) throw error;
    }
  }
  return { calendarId: await createCalendar(token, calendarName, fetcher), newlyCreated: true };
}

async function listManagedEvents(token: string, calendarId: string, fromDate: string, appMarker: string, fetcher: Fetcher) {
  const events: GoogleCalendarEvent[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      singleEvents: "true",
      maxResults: "2500",
      timeMin: `${fromDate}T00:00:00Z`,
      privateExtendedProperty: `app=${appMarker}`,
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await calendarRequest<EventListResponse>(token, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {}, fetcher);
    events.push(...(page.items || []));
    pageToken = page.nextPageToken || "";
  } while (pageToken);
  return events;
}

function eventKey(planId: string, workoutId: string) {
  return `${planId}:${workoutId}`;
}

export async function syncGoogleCalendar({
  token,
  existingCalendarId,
  plan,
  workouts,
  appBaseUrl,
  today = format(new Date(), "yyyy-MM-dd"),
  fetcher = fetch,
}: {
  token: string;
  existingCalendarId?: string;
  plan: UserPlan | null;
  workouts: UserWorkout[];
  appBaseUrl: string;
  today?: string;
  fetcher?: Fetcher;
}): Promise<CalendarSyncResult> {
  const { calendarId, newlyCreated } = await ensureCalendar(token, existingCalendarId, GOOGLE_CALENDAR_NAME, fetcher);
  const result: CalendarSyncResult = { calendarId, calendarName: GOOGLE_CALENDAR_NAME, created: 0, updated: 0, skipped: 0, deleted: 0, failed: 0, workoutUpdates: [] };
  const listFrom = plan && plan.startDate < today ? plan.startDate : today;
  const managedEvents = newlyCreated ? [] : await listManagedEvents(token, calendarId, listFrom, "training-plan-tracker", fetcher);
  const activeKeys = new Set(plan ? workouts.map((workout) => eventKey(plan.id, workout.id)) : []);
  const listedEvents = new Map<string, GoogleCalendarEvent>();

  for (const event of managedEvents) {
    const metadata = event.extendedProperties?.private;
    if (!event.id || !metadata?.planId || !metadata.workoutId) continue;
    const key = eventKey(metadata.planId, metadata.workoutId);
    listedEvents.set(key, event);
    if (!activeKeys.has(key) && (event.start?.date || "") >= today) {
      try {
        await calendarRequest(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`, { method: "DELETE" }, fetcher);
        result.deleted += 1;
      } catch (error) {
        if (error instanceof GoogleCalendarError && (error.status === 401 || error.status === 403)) throw error;
        result.failed += 1;
      }
    }
  }

  if (!plan) return result;
  for (const workout of workouts) {
    const payload = calendarEventForWorkout(plan, workout, appBaseUrl);
    const fingerprint = fingerprintCalendarEvent(payload);
    const listed = listedEvents.get(eventKey(plan.id, workout.id));
    const existingEventId = newlyCreated ? undefined : listed?.id || workout.googleCalendarEventId;
    if (existingEventId && listed?.id === existingEventId && workout.googleCalendarFingerprint === fingerprint) {
      result.skipped += 1;
      result.workoutUpdates.push({ workoutId: workout.id, eventId: existingEventId, fingerprint });
      continue;
    }

    try {
      let event: GoogleCalendarEvent;
      if (existingEventId) {
        try {
          event = await calendarRequest(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existingEventId)}`, { method: "PATCH", body: JSON.stringify(payload) }, fetcher);
          result.updated += 1;
        } catch (error) {
          if (!(error instanceof GoogleCalendarError) || error.status !== 404) throw error;
          event = await calendarRequest(token, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(payload) }, fetcher);
          result.created += 1;
        }
      } else {
        event = await calendarRequest(token, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(payload) }, fetcher);
        result.created += 1;
      }
      if (!event.id) throw new Error("Google Calendar did not return an event ID");
      result.workoutUpdates.push({ workoutId: workout.id, eventId: event.id, fingerprint });
    } catch (error) {
      if (error instanceof GoogleCalendarError && (error.status === 401 || error.status === 403)) throw error;
      result.failed += 1;
    }
  }
  return result;
}

export function calendarEventForChore(chore: Chore, appBaseUrl: string) {
  const details = [
    chore.assigneeEmail ? `Assigned to: ${chore.assigneeEmail}` : "Assigned to: either partner",
    chore.notes || "",
    "",
    `Open Daybook: ${appBaseUrl}`,
  ].filter((line, index, lines) => line || (index > 0 && lines[index - 1]));

  return {
    summary: `${chore.completed ? "✓ " : ""}${chore.title}`,
    description: details.join("\n"),
    start: { date: chore.scheduledDate },
    end: { date: format(addDays(parseISO(chore.scheduledDate), 1), "yyyy-MM-dd") },
    transparency: "transparent",
    reminders: { useDefault: true },
    source: { title: "Open in Daybook", url: appBaseUrl },
    extendedProperties: {
      private: {
        app: "daybook-home",
        choreId: chore.id,
      },
    },
  };
}

export async function syncHomeGoogleCalendar({
  token,
  existingCalendarId,
  chores,
  appBaseUrl,
  today = format(new Date(), "yyyy-MM-dd"),
  fetcher = fetch,
}: {
  token: string;
  existingCalendarId?: string;
  chores: Chore[];
  appBaseUrl: string;
  today?: string;
  fetcher?: Fetcher;
}): Promise<CalendarSyncResult> {
  const { calendarId, newlyCreated } = await ensureCalendar(token, existingCalendarId, HOME_GOOGLE_CALENDAR_NAME, fetcher);
  const result: CalendarSyncResult = { calendarId, calendarName: HOME_GOOGLE_CALENDAR_NAME, created: 0, updated: 0, skipped: 0, deleted: 0, failed: 0, workoutUpdates: [] };
  const listFrom = chores.reduce((earliest, chore) => chore.scheduledDate < earliest ? chore.scheduledDate : earliest, today);
  const managedEvents = newlyCreated ? [] : await listManagedEvents(token, calendarId, listFrom, "daybook-home", fetcher);
  const activeIds = new Set(chores.map((chore) => chore.id));
  const listedEvents = new Map<string, GoogleCalendarEvent>();

  for (const event of managedEvents) {
    const metadata = event.extendedProperties?.private;
    if (!event.id || !metadata?.choreId) continue;
    listedEvents.set(metadata.choreId, event);
    if (!activeIds.has(metadata.choreId) && (event.start?.date || "") >= today) {
      try {
        await calendarRequest(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`, { method: "DELETE" }, fetcher);
        result.deleted += 1;
      } catch (error) {
        if (error instanceof GoogleCalendarError && (error.status === 401 || error.status === 403)) throw error;
        result.failed += 1;
      }
    }
  }

  for (const chore of chores) {
    const basePayload = calendarEventForChore(chore, appBaseUrl);
    const fingerprint = fingerprintCalendarEvent(basePayload);
    const payload = {
      ...basePayload,
      extendedProperties: { private: { ...basePayload.extendedProperties.private, fingerprint } },
    };
    const listed = listedEvents.get(chore.id);
    if (listed?.id && listed.extendedProperties?.private?.fingerprint === fingerprint) {
      result.skipped += 1;
      continue;
    }

    try {
      if (listed?.id) {
        await calendarRequest(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(listed.id)}`, { method: "PATCH", body: JSON.stringify(payload) }, fetcher);
        result.updated += 1;
      } else {
        await calendarRequest(token, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(payload) }, fetcher);
        result.created += 1;
      }
    } catch (error) {
      if (error instanceof GoogleCalendarError && (error.status === 401 || error.status === 403)) throw error;
      result.failed += 1;
    }
  }

  return result;
}

export async function deleteGoogleCalendar(token: string, calendarId: string, fetcher: Fetcher = fetch) {
  try {
    await calendarRequest(token, `/calendars/${encodeURIComponent(calendarId)}`, { method: "DELETE" }, fetcher);
  } catch (error) {
    if (!(error instanceof GoogleCalendarError) || error.status !== 404) throw error;
  }
}
