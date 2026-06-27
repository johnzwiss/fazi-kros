import { CalendarDays, Check, ChevronDown, Circle, Footprints, NotebookPen, PartyPopper, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { currentWeekNumber, dateForWorkout, prettyDate } from "../date";
import { planProgress } from "../stats";
import { DAYS, type DayKey, type UserPlan, type UserWorkout } from "../types";
import { EmptyState, ProgressBar } from "./Layout";

const DAY_NAMES: Record<DayKey, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

interface DashboardProps {
  plan: UserPlan | null;
  workouts: UserWorkout[];
  note: string;
  busy?: boolean;
  onOpenLibrary: () => void;
  onWeekChange: (week: number) => void;
  onToggle: (workout: UserWorkout, complete: boolean, actualMiles?: number) => Promise<void>;
  onBulk: (workouts: UserWorkout[], complete: boolean) => Promise<void>;
  onNote: (value: string) => Promise<void>;
  onFinish: (completed: boolean) => Promise<void>;
}

export function Dashboard({ plan, workouts, note, busy, onOpenLibrary, onWeekChange, onToggle, onBulk, onNote, onFinish }: DashboardProps) {
  const [week, setWeek] = useState(plan ? currentWeekNumber(plan.startDate, plan.weekCount) : 1);
  const [noteDraft, setNoteDraft] = useState(note);
  useEffect(() => setNoteDraft(note), [note]);
  useEffect(() => {
    if (plan) {
      const next = currentWeekNumber(plan.startDate, plan.weekCount);
      setWeek(next);
      onWeekChange(next);
    }
  }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan) {
    return <EmptyState icon={<Footprints size={42} />} title="Your next plan starts here" body="Choose a plan from the library, pick a Monday, and your weekly tracker will be ready." action={<button onClick={onOpenLibrary}>Browse plans</button>} />;
  }

  const weekWorkouts = workouts.filter((workout) => workout.weekNumber === week);
  const completeCount = weekWorkouts.filter((workout) => workout.completed).length;
  const percent = weekWorkouts.length ? Math.round((completeCount / weekWorkouts.length) * 100) : 0;
  const plannedMiles = weekWorkouts.reduce((sum, workout) => sum + (workout.plannedMiles ?? 0), 0);
  const weekLabel = `${prettyDate(dateForWorkout(plan.startDate, week, "mon"))}–${prettyDate(dateForWorkout(plan.startDate, week, "sun"))}`;

  function selectWeek(value: number) {
    setWeek(value);
    onWeekChange(value);
  }

  return (
    <div className="page-stack">
      <section className="page-heading dashboard-heading">
        <div><p className="eyebrow">Active plan</p><h1>{plan.title}</h1><p>{plan.description}</p></div>
        <div className="week-picker"><CalendarDays size={18} /><select value={week} onChange={(event) => selectWeek(Number(event.target.value))}>
          {Array.from({ length: plan.weekCount }, (_, index) => <option key={index + 1} value={index + 1}>Week {index + 1}</option>)}
        </select></div>
      </section>

      <section className="summary-grid">
        <article className="card progress-card">
          <div className="card-row"><div><p className="eyebrow">Week {week}</p><h2>{weekLabel}</h2></div><strong className="percent">{percent}%</strong></div>
          <ProgressBar value={percent} />
          <p className="muted">{completeCount} of {weekWorkouts.length} workouts complete</p>
        </article>
        <article className="stat-card"><span>Planned miles</span><strong>{plannedMiles || "—"}</strong><small>this week</small></article>
        <article className="stat-card"><span>Plan progress</span><strong>{planProgress(plan)}%</strong><small>{plan.completedWorkouts}/{plan.totalWorkouts} workouts</small></article>
      </section>

      <section className="toolbar card">
        <div><strong>Weekly checklist</strong><span>{completeCount === weekWorkouts.length ? "Beautiful work. Week handled." : "Small boxes, satisfying clicks."}</span></div>
        <div className="button-row">
          <button className="secondary small-button" disabled={busy} onClick={() => onBulk(weekWorkouts, false)}><RotateCcw size={15} /> Clear</button>
          <button className="small-button" disabled={busy} onClick={() => onBulk(weekWorkouts, true)}><Check size={15} /> Mark week complete</button>
        </div>
      </section>

      <section className="days-grid">
        {DAYS.map((day) => {
          const items = weekWorkouts.filter((workout) => workout.day === day);
          const date = weekWorkouts.find((workout) => workout.day === day)?.scheduledDate;
          return <article className="day-card" key={day}>
            <header><div><p>{DAY_NAMES[day]}</p><span>{date ? prettyDate(date, "MMM d") : "Rest day"}</span></div>{items.length > 0 && <span className="day-count">{items.filter((item) => item.completed).length}/{items.length}</span>}</header>
            {items.length ? items.map((workout) => <WorkoutItem key={workout.id} workout={workout} disabled={busy} onToggle={onToggle} />) : <div className="rest-day"><Circle size={16} /><span>Rest, walk, or mobility</span></div>}
          </article>;
        })}
      </section>

      <section className="content-grid">
        <article className="card notes-card">
          <div className="section-title"><NotebookPen size={20} /><div><h2>Week {week} notes</h2><p>Energy, aches, wins, weather—the useful little truths.</p></div></div>
          <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} onBlur={() => onNote(noteDraft)} placeholder="How did this week feel?" />
          <small className="muted">Saved when you leave this field.</small>
        </article>
        <article className="card guidance-card">
          <h2>Plan guidance</h2>
          <ul>{plan.guidance.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </article>
      </section>

      <section className="card finish-card">
        <div><PartyPopper size={22} /><div><h2>Done with this plan?</h2><p>Complete it for your history, or archive it if your training changed.</p></div></div>
        <div className="button-row"><button className="secondary" onClick={() => onFinish(false)}>Archive plan</button><button onClick={() => onFinish(true)}>Finish plan</button></div>
      </section>
    </div>
  );
}

function WorkoutItem({ workout, disabled, onToggle }: { workout: UserWorkout; disabled?: boolean; onToggle: DashboardProps["onToggle"] }) {
  const [expanded, setExpanded] = useState(false);
  const [miles, setMiles] = useState(String(workout.actualMiles ?? workout.plannedMiles ?? ""));
  useEffect(() => setMiles(String(workout.actualMiles ?? workout.plannedMiles ?? "")), [workout.actualMiles, workout.plannedMiles]);
  const hasDetails = Boolean(workout.instructions || workout.exercises?.length || workout.plannedMinutes);
  const meta = useMemo(() => [workout.plannedMiles != null ? `${workout.plannedMiles} mi` : "", workout.plannedMinutes ? `${workout.plannedMinutes} min` : ""].filter(Boolean).join(" · "), [workout]);
  return <div className={workout.completed ? "workout-item complete" : "workout-item"}>
    <div className="workout-top">
      <label className="check-label"><input type="checkbox" checked={workout.completed} disabled={disabled} onChange={(event) => onToggle(workout, event.target.checked, event.target.checked && workout.type === "running" ? Number(miles) || workout.plannedMiles : undefined)} /><span className="custom-check">{workout.completed && <Check size={13} />}</span></label>
      <button className="workout-summary" onClick={() => hasDetails && setExpanded((value) => !value)}>
        <span className={`type-dot ${workout.type}`} />
        <span><strong>{workout.title}</strong><small>{workout.type.replace("_", " ")}{meta ? ` · ${meta}` : ""}</small></span>
        {hasDetails && <ChevronDown className={expanded ? "rotated" : ""} size={17} />}
      </button>
    </div>
    {expanded && <div className="workout-details">
      {workout.instructions && <p>{workout.instructions}</p>}
      {workout.exercises?.map((exercise, index) => <div className="exercise-row" key={index}><span>{exercise.name}</span><strong>{exercise.prescription}</strong></div>)}
    </div>}
    {workout.completed && workout.type === "running" && <div className="actual-miles"><label>Actual miles <input type="number" min="0" step="0.1" value={miles} onChange={(event) => setMiles(event.target.value)} /></label><button className="text-button" onClick={() => onToggle(workout, true, Number(miles))}>Update</button></div>}
  </div>;
}
