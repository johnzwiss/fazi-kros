import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Footprints,
  GripVertical,
  NotebookPen,
  PartyPopper,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { currentWeekNumber, dateForWorkout, dayKeyForDate, prettyDate, weekNumberForDate } from "../date";
import { planProgress } from "../stats";
import { DAYS, type DayKey, type TemplateWorkout, type UserPlan, type UserWorkout } from "../types";
import { EmptyState, ProgressBar } from "./Layout";
import { WorkoutEditor } from "./WorkoutEditor";

const DAY_NAMES: Record<DayKey, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const CALENDAR_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type CalendarView = "day" | "week" | "month";

interface DashboardProps {
  plan: UserPlan | null;
  workouts: UserWorkout[];
  note: string;
  restDays: Partial<Record<DayKey, boolean>>;
  busy?: boolean;
  onOpenLibrary: () => void;
  onWeekChange: (week: number) => void;
  onToggle: (workout: UserWorkout, complete: boolean, actualMiles?: number) => Promise<void>;
  onAdd: (weekNumber: number, workout: TemplateWorkout) => Promise<void>;
  onEdit: (workout: UserWorkout, changes: Partial<TemplateWorkout>) => Promise<void>;
  onToggleRest: (day: DayKey, complete: boolean) => Promise<void>;
  onBulk: (workouts: UserWorkout[], complete: boolean) => Promise<void>;
  onNote: (value: string) => Promise<void>;
  onFinish: (completed: boolean) => Promise<void>;
}

export function Dashboard({ plan, workouts, note, restDays, busy, onOpenLibrary, onWeekChange, onToggle, onAdd, onEdit, onToggleRest, onBulk, onNote, onFinish }: DashboardProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [selectedDate, setSelectedDate] = useState(today);
  const [monthDate, setMonthDate] = useState(startOfMonth(parseISO(today)));
  const [week, setWeek] = useState(plan ? currentWeekNumber(plan.startDate, plan.weekCount) : 1);
  const [noteDraft, setNoteDraft] = useState(note);
  const [editing, setEditing] = useState<UserWorkout | null>(null);
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [dragged, setDragged] = useState<UserWorkout | null>(null);
  const [dropDay, setDropDay] = useState<DayKey | null>(null);

  useEffect(() => setNoteDraft(note), [note]);
  useEffect(() => {
    setCalendarView("week");
    setSelectedDate(today);
    setMonthDate(startOfMonth(parseISO(today)));
    if (plan) {
      const next = currentWeekNumber(plan.startDate, plan.weekCount);
      setWeek(next);
      onWeekChange(next);
    }
  }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan) {
    return <EmptyState icon={<Footprints size={42} />} title="Your next plan starts here" body="Choose a plan from the library, pick a Monday, and your weekly tracker will be ready." action={<button onClick={onOpenLibrary}>Browse plans</button>} />;
  }
  const activePlan = plan;

  const selectedInPlan = selectedDate >= plan.startDate && selectedDate <= plan.endDate;
  const selectedWeekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const selectedWeekEnd = endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const weekDates = eachDayOfInterval({ start: selectedWeekStart, end: selectedWeekEnd }).map((date) => format(date, "yyyy-MM-dd"));
  const weekWorkouts = workouts.filter((workout) => workout.scheduledDate >= weekDates[0] && workout.scheduledDate <= weekDates[6]);
  const restDates = weekDates.filter((date) => date >= plan.startDate && date <= plan.endDate && !weekWorkouts.some((workout) => workout.scheduledDate === date));
  const completeCount = weekWorkouts.filter((workout) => workout.completed).length + restDates.filter((date) => restDays[dayKeyForDate(date)]).length;
  const checklistCount = weekWorkouts.length + restDates.length;
  const percent = checklistCount ? Math.round((completeCount / checklistCount) * 100) : 0;
  const plannedMiles = weekWorkouts.reduce((sum, workout) => sum + (workout.plannedMiles ?? 0), 0);
  const weekLabel = `${format(selectedWeekStart, "MMM d")}–${format(selectedWeekEnd, "MMM d")}`;

  function selectCalendarDate(value: string) {
    setSelectedDate(value);
    setMonthDate(startOfMonth(parseISO(value)));
    if (value >= activePlan.startDate && value <= activePlan.endDate) {
      const nextWeek = weekNumberForDate(activePlan.startDate, activePlan.weekCount, value);
      setWeek(nextWeek);
      onWeekChange(nextWeek);
    }
  }

  function selectPlanWeek(value: number) {
    setWeek(value);
    const monday = dateForWorkout(activePlan.startDate, value, "mon");
    setSelectedDate(monday);
    setMonthDate(startOfMonth(parseISO(monday)));
    onWeekChange(value);
  }

  function moveCalendar(direction: number) {
    if (calendarView === "month") {
      const next = addMonths(monthDate, direction);
      setMonthDate(next);
      selectCalendarDate(format(next, "yyyy-MM-dd"));
    } else {
      selectCalendarDate(format(addDays(parseISO(selectedDate), direction * (calendarView === "week" ? 7 : 1)), "yyyy-MM-dd"));
    }
  }

  async function setVisibleComplete(complete: boolean) {
    await onBulk(weekWorkouts, complete);
    for (const date of restDates) await onToggleRest(dayKeyForDate(date), complete);
  }

  async function dropWorkout(day: DayKey) {
    const workout = dragged;
    setDragged(null);
    setDropDay(null);
    if (workout && workout.day !== day) await onEdit(workout, { day });
  }

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  });

  return <div className="page-stack">
    <section className="page-heading dashboard-heading">
      <div><p className="eyebrow">Active plan</p><h1>{plan.title}</h1><p>{plan.description}</p></div>
      <div className="week-picker"><CalendarDays size={18} /><select value={week} onChange={(event) => selectPlanWeek(Number(event.target.value))}>
        {Array.from({ length: plan.weekCount }, (_, index) => <option key={index + 1} value={index + 1}>Plan week {index + 1}</option>)}
      </select></div>
    </section>

    <section className="calendar-toolbar card">
      <div className="view-switch" aria-label="Calendar view">
        {(["day", "week", "month"] as CalendarView[]).map((value) => <button key={value} className={calendarView === value ? "active" : ""} onClick={() => setCalendarView(value)}>{value === "week" ? "Week" : value[0].toUpperCase() + value.slice(1)}</button>)}
      </div>
      <div className="calendar-navigation">
        <button className="icon-button" onClick={() => moveCalendar(-1)} aria-label={`Previous ${calendarView}`}><ChevronLeft size={19} /></button>
        <button className="today-button" onClick={() => selectCalendarDate(today)}>Today · {prettyDate(today, "MMM d")}</button>
        <button className="icon-button" onClick={() => moveCalendar(1)} aria-label={`Next ${calendarView}`}><ChevronRight size={19} /></button>
      </div>
    </section>

    <section className="summary-grid">
      <article className="card progress-card">
        <div className="card-row"><div><p className="eyebrow">{selectedInPlan ? `Plan week ${week}` : "Calendar week"}</p><h2>{weekLabel}</h2></div><strong className="percent">{percent}%</strong></div>
        <ProgressBar value={percent} />
        <p className="muted">{checklistCount ? `${completeCount} of ${checklistCount} checklist items complete` : `No plan items this week · plan starts ${prettyDate(plan.startDate, "MMM d")}`}</p>
      </article>
      <article className="stat-card"><span>Planned miles</span><strong>{plannedMiles || "—"}</strong><small>displayed week</small></article>
      <article className="stat-card"><span>Plan progress</span><strong>{planProgress(plan)}%</strong><small>{plan.completedWorkouts}/{plan.totalWorkouts} workouts</small></article>
    </section>

    {calendarView !== "month" && <section className="toolbar card">
      <div><strong>{calendarView === "day" ? prettyDate(selectedDate, "EEEE, MMMM d") : "Weekly checklist"}</strong><span>Drag the grip to move a workout, or use its pencil to edit.</span></div>
      {calendarView === "week" && <div className="button-row">
        <button className="secondary small-button" disabled={busy || !checklistCount} onClick={() => setVisibleComplete(false)}><RotateCcw size={15} /> Clear</button>
        <button className="small-button" disabled={busy || !checklistCount} onClick={() => setVisibleComplete(true)}><Check size={15} /> Mark week complete</button>
      </div>}
    </section>}

    {calendarView === "week" && <section className="days-grid">
      {weekDates.map((date) => <DayCard key={date} date={date} plan={plan} today={today} items={weekWorkouts.filter((workout) => workout.scheduledDate === date)} restChecked={Boolean(restDays[dayKeyForDate(date)])} busy={busy} dragged={dragged} dropDay={dropDay} onToggle={onToggle} onAdd={setAddingDate} onEdit={setEditing} onToggleRest={onToggleRest} onDragStart={setDragged} onDragEnd={() => { setDragged(null); setDropDay(null); }} onDragOver={setDropDay} onDrop={dropWorkout} />)}
    </section>}

    {calendarView === "day" && <section className="day-view">
      <DayCard date={selectedDate} plan={plan} today={today} items={workouts.filter((workout) => workout.scheduledDate === selectedDate)} restChecked={Boolean(restDays[dayKeyForDate(selectedDate)])} busy={busy} dragged={dragged} dropDay={dropDay} onToggle={onToggle} onAdd={setAddingDate} onEdit={setEditing} onToggleRest={onToggleRest} onDragStart={setDragged} onDragEnd={() => { setDragged(null); setDropDay(null); }} onDragOver={setDropDay} onDrop={dropWorkout} />
    </section>}

    {calendarView === "month" && <section className="month-card card">
      <div className="month-heading"><h2>{format(monthDate, "MMMM yyyy")}</h2><span>Select a date to open Day view</span></div>
      <div className="month-grid month-weekdays">{CALENDAR_DAY_NAMES.map((name) => <span key={name}>{name}</span>)}</div>
      <div className="month-grid">{monthDays.map((date) => {
        const value = format(date, "yyyy-MM-dd");
        const items = workouts.filter((workout) => workout.scheduledDate === value);
        return <button key={value} className={["month-day", !isSameMonth(date, monthDate) ? "outside-month" : "", value === today ? "today" : "", value < plan.startDate || value > plan.endDate ? "outside-plan" : ""].filter(Boolean).join(" ")} onClick={() => { selectCalendarDate(value); setCalendarView("day"); }}>
          <strong>{format(date, "d")}</strong>
          <span>{items.slice(0, 3).map((workout) => <small className={workout.completed ? "complete" : ""} key={workout.id}>{workout.title}</small>)}</span>
          {items.length > 3 && <em>+{items.length - 3} more</em>}
        </button>;
      })}</div>
    </section>}

    {calendarView !== "month" && selectedInPlan && <section className="content-grid">
      <article className="card notes-card">
        <div className="section-title"><NotebookPen size={20} /><div><h2>Plan week {week} notes</h2><p>Energy, aches, wins, weather—the useful little truths.</p></div></div>
        <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} onBlur={() => onNote(noteDraft)} placeholder="How did this week feel?" />
        <small className="muted">Saved when you leave this field.</small>
      </article>
      <article className="card guidance-card"><h2>Plan guidance</h2><ul>{plan.guidance.map((item, index) => <li key={index}>{item}</li>)}</ul></article>
    </section>}

    <section className="card finish-card">
      <div><PartyPopper size={22} /><div><h2>Done with this plan?</h2><p>Complete it for your history, or archive it if your training changed.</p></div></div>
      <div className="button-row"><button className="secondary" onClick={() => onFinish(false)}>Archive plan</button><button onClick={() => onFinish(true)}>Finish plan</button></div>
    </section>

    {editing && <WorkoutEditor workout={editing} onClose={() => setEditing(null)} onSave={(changes) => onEdit(editing, changes)} />}
    {addingDate && <WorkoutEditor
      mode="create"
      workout={{ id: "new", weekNumber: weekNumberForDate(plan.startDate, plan.weekCount, addingDate), scheduledDate: addingDate, day: dayKeyForDate(addingDate), type: "running", title: "", completed: false }}
      onClose={() => setAddingDate(null)}
      onSave={async (changes) => {
        const workout: TemplateWorkout = {
          day: changes.day || dayKeyForDate(addingDate),
          type: changes.type || "running",
          title: changes.title?.trim() || "Workout",
          ...(changes.instructions ? { instructions: changes.instructions } : {}),
          ...(changes.plannedMiles != null ? { plannedMiles: changes.plannedMiles } : {}),
          ...(changes.plannedMinutes != null ? { plannedMinutes: changes.plannedMinutes } : {}),
          ...(changes.exercises?.length ? { exercises: changes.exercises } : {}),
        };
        await onAdd(weekNumberForDate(plan.startDate, plan.weekCount, addingDate), workout);
      }}
    />}
  </div>;
}

interface DayCardProps {
  date: string;
  plan: UserPlan;
  today: string;
  items: UserWorkout[];
  restChecked: boolean;
  busy?: boolean;
  dragged: UserWorkout | null;
  dropDay: DayKey | null;
  onToggle: DashboardProps["onToggle"];
  onAdd: (date: string) => void;
  onEdit: (workout: UserWorkout) => void;
  onToggleRest: DashboardProps["onToggleRest"];
  onDragStart: (workout: UserWorkout) => void;
  onDragEnd: () => void;
  onDragOver: (day: DayKey) => void;
  onDrop: (day: DayKey) => Promise<void>;
}

function DayCard({ date, plan, today, items, restChecked, busy, dragged, dropDay, onToggle, onAdd, onEdit, onToggleRest, onDragStart, onDragEnd, onDragOver, onDrop }: DayCardProps) {
  const day = dayKeyForDate(date);
  const inPlan = date >= plan.startDate && date <= plan.endDate;
  return <article
    className={["day-card", date === today ? "today" : "", dropDay === day ? "drop-target" : ""].filter(Boolean).join(" ")}
    onDragOver={(event) => { if (dragged && inPlan) { event.preventDefault(); onDragOver(day); } }}
    onDrop={(event) => { event.preventDefault(); if (inPlan) void onDrop(day); }}
  >
    <header><div><p>{DAY_NAMES[day]}{date === today && <span className="today-pill">Today</span>}</p><span>{prettyDate(date, "MMM d")}</span></div><div className="day-header-actions">{items.length > 0 && <span className="day-count">{items.filter((item) => item.completed).length}/{items.length}</span>}{inPlan && <button type="button" className="day-add-button" disabled={busy} onClick={() => onAdd(date)} aria-label={`Add workout on ${prettyDate(date, "MMMM d")}`} title="Add workout"><Plus size={15} /></button>}</div></header>
    {items.length ? items.map((workout) => <WorkoutItem key={workout.id} workout={workout} disabled={busy} onToggle={onToggle} onEdit={() => onEdit(workout)} onDragStart={() => onDragStart(workout)} onDragEnd={onDragEnd} />) : inPlan ? <label className="rest-day-check"><input type="checkbox" checked={restChecked} disabled={busy} onChange={(event) => onToggleRest(day, event.target.checked)} /><span className="custom-check">{restChecked && <Check size={14} />}</span><span><strong>Rest / walk / mobility</strong><small>Recovery counts, too.</small></span></label> : <div className="outside-plan-day">No plan scheduled for this date.</div>}
  </article>;
}

function WorkoutItem({ workout, disabled, onToggle, onEdit, onDragStart, onDragEnd }: { workout: UserWorkout; disabled?: boolean; onToggle: DashboardProps["onToggle"]; onEdit: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [miles, setMiles] = useState(String(workout.actualMiles ?? workout.plannedMiles ?? ""));
  useEffect(() => setMiles(String(workout.actualMiles ?? workout.plannedMiles ?? "")), [workout.actualMiles, workout.plannedMiles]);
  const hasDetails = Boolean(workout.instructions || workout.exercises?.length || workout.plannedMinutes);
  const meta = useMemo(() => [workout.plannedMiles != null ? `${workout.plannedMiles} mi` : "", workout.plannedMinutes ? `${workout.plannedMinutes} min` : ""].filter(Boolean).join(" · "), [workout]);
  async function toggle(complete: boolean) {
    if (saving) return;
    setSaving(true);
    try { await onToggle(workout, complete, complete && workout.type === "running" ? Number(miles) || workout.plannedMiles : undefined); } finally { setSaving(false); }
  }
  return <div className={workout.completed ? "workout-item complete" : "workout-item"}>
    <div className="workout-top">
      <label className={saving ? "check-label saving" : "check-label"}><input type="checkbox" checked={workout.completed} disabled={disabled || saving} onChange={(event) => toggle(event.target.checked)} /><span className="custom-check">{workout.completed && <Check size={14} />}</span></label>
      <button className="workout-summary" onClick={() => hasDetails && setExpanded((value) => !value)}>
        <span className={`type-dot ${workout.type}`} />
        <span><strong>{workout.title}</strong><small>{workout.type.replace("_", " ")}{meta ? ` · ${meta}` : ""}</small></span>
        {hasDetails && <ChevronDown className={expanded ? "rotated" : ""} size={17} />}
      </button>
      <div className="workout-tile-actions">
        <button type="button" className="tile-icon drag-handle" draggable={!disabled} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", workout.id); onDragStart(); }} onDragEnd={onDragEnd} aria-label={`Move ${workout.title}`} title="Drag to another day"><GripVertical size={17} /></button>
        <button type="button" className="tile-icon" onClick={onEdit} aria-label={`Edit ${workout.title}`} title="Edit workout"><Pencil size={15} /></button>
      </div>
    </div>
    {expanded && <div className="workout-details">{workout.instructions && <p>{workout.instructions}</p>}{workout.exercises?.map((exercise, index) => <div className="exercise-row" key={index}><span>{exercise.name}</span><strong>{exercise.prescription}</strong></div>)}</div>}
    {workout.completed && workout.type === "running" && <div className="actual-miles"><label>Actual miles <input type="number" min="0" step="0.1" value={miles} onChange={(event) => setMiles(event.target.value)} /></label><button className="text-button" onClick={() => onToggle(workout, true, Number(miles))}>Update</button></div>}
  </div>;
}
