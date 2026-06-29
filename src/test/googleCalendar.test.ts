import { describe, expect, it, vi } from "vitest";
import { calendarEventForChore, calendarEventForWorkout, fingerprintCalendarEvent, syncGoogleCalendar, syncHomeGoogleCalendar } from "../googleCalendar";
import type { Chore, UserPlan, UserWorkout } from "../types";

const plan: UserPlan = { id: "plan-1", sourceTemplateId: "template", title: "Base Plan", description: "", guidance: [], startDate: "2026-06-29", endDate: "2026-07-05", weekCount: 1, status: "active", totalWorkouts: 1, completedWorkouts: 0, plannedMiles: 4, completedMiles: 0 };
const workout: UserWorkout = { id: "workout-1", weekNumber: 1, scheduledDate: "2026-07-04", day: "sat", type: "running", title: "Easy run", plannedMiles: 4, completed: false };
const chore: Chore = { id: "chore-1", title: "Vacuum", scheduledDate: "2026-07-02", assigneeEmail: "alex@example.com", notes: "Upstairs too", completed: false, createdBy: "alex" };

function response(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("Google Calendar mapping", () => {
  it("creates a transparent all-day event with a direct Day link", () => {
    const event = calendarEventForWorkout(plan, workout, "https://johnzwiss.github.io/fazi-kros/");
    expect(event.start.date).toBe("2026-07-04");
    expect(event.end.date).toBe("2026-07-05");
    expect(event.transparency).toBe("transparent");
    expect(event.source.url).toContain("plan=plan-1&date=2026-07-04&view=day");
    expect(event.description).toContain("Open this day");
    expect(fingerprintCalendarEvent(event)).toBe(fingerprintCalendarEvent(event));
  });

  it("creates a calendar and inserts missing workouts", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { id: "calendar-1" }))
      .mockResolvedValueOnce(response(200, { id: "event-1" }));
    const result = await syncGoogleCalendar({ token: "token", plan, workouts: [workout], appBaseUrl: "https://example.com/fazi-kros/", today: "2026-06-28", fetcher });
    expect(result.created).toBe(1);
    expect(result.workoutUpdates[0].eventId).toBe("event-1");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("maps a chore to the shared Home calendar", () => {
    const event = calendarEventForChore(chore, "https://example.com/fazi-kros/");
    expect(event.summary).toBe("Vacuum");
    expect(event.start.date).toBe("2026-07-02");
    expect(event.description).toContain("Assigned to: alex@example.com");
    expect(event.description).toContain("Upstairs too");
    expect(event.extendedProperties.private.choreId).toBe("chore-1");
  });

  it("creates a separate Daybook Home calendar and inserts chores", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { id: "home-calendar" }))
      .mockResolvedValueOnce(response(200, { id: "chore-event" }));
    const result = await syncHomeGoogleCalendar({ token: "token", chores: [chore], appBaseUrl: "https://example.com/fazi-kros/", today: "2026-06-29", fetcher });
    expect(result.calendarName).toBe("Daybook — Home");
    expect(result.created).toBe(1);
    const createOptions = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(createOptions.body)).summary).toBe("Daybook — Home");
  });

  it("skips an unchanged event without creating a duplicate", async () => {
    const fingerprint = fingerprintCalendarEvent(calendarEventForWorkout(plan, workout, "https://example.com/fazi-kros/"));
    const syncedWorkout = { ...workout, googleCalendarEventId: "event-1", googleCalendarFingerprint: fingerprint };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { id: "calendar-1" }))
      .mockResolvedValueOnce(response(200, { items: [{ id: "event-1", start: { date: workout.scheduledDate }, extendedProperties: { private: { app: "training-plan-tracker", planId: plan.id, workoutId: workout.id } } }] }));
    const result = await syncGoogleCalendar({ token: "token", existingCalendarId: "calendar-1", plan, workouts: [syncedWorkout], appBaseUrl: "https://example.com/fazi-kros/", today: "2026-06-28", fetcher });
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
  });

  it("recreates a workout event deleted from Google Calendar", async () => {
    const staleWorkout = { ...workout, googleCalendarEventId: "missing-event", googleCalendarFingerprint: "old" };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { id: "calendar-1" }))
      .mockResolvedValueOnce(response(200, { items: [] }))
      .mockResolvedValueOnce(response(404, { error: { message: "Not found" } }))
      .mockResolvedValueOnce(response(200, { id: "replacement-event" }));
    const result = await syncGoogleCalendar({ token: "token", existingCalendarId: "calendar-1", plan, workouts: [staleWorkout], appBaseUrl: "https://example.com/fazi-kros/", today: "2026-06-28", fetcher });
    expect(result.created).toBe(1);
    expect(result.workoutUpdates[0].eventId).toBe("replacement-event");
  });

  it("cleans future managed events while preserving history", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { id: "calendar-1" }))
      .mockResolvedValueOnce(response(200, { items: [
        { id: "past", start: { date: "2026-06-27" }, extendedProperties: { private: { planId: "old", workoutId: "past" } } },
        { id: "future", start: { date: "2026-06-29" }, extendedProperties: { private: { planId: "old", workoutId: "future" } } },
      ] }))
      .mockResolvedValueOnce(response(204));
    const result = await syncGoogleCalendar({ token: "token", existingCalendarId: "calendar-1", plan: null, workouts: [], appBaseUrl: "https://example.com/fazi-kros/", today: "2026-06-28", fetcher });
    expect(result.deleted).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
