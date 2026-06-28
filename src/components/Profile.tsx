import { Award, CalendarSync, Dumbbell, Footprints, Medal, Route, Save, Share2, Target, Trash2 } from "lucide-react";
import { format, parseISO, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import { prettyDate } from "../date";
import { planProgress } from "../stats";
import type { UserPlan, UserProfile, UserWorkout } from "../types";

interface ProfileProps {
  profile: UserProfile;
  plans: UserPlan[];
  workouts: UserWorkout[];
  busy?: boolean;
  calendarBusy?: boolean;
  calendarMessage?: string;
  onSave: (updates: Partial<UserProfile>) => Promise<void>;
  onCalendarSync?: () => Promise<void>;
  onCalendarDisconnect?: () => Promise<void>;
}

export function Profile({ profile, plans, workouts, busy, calendarBusy, calendarMessage, onSave, onCalendarSync, onCalendarDisconnect }: ProfileProps) {
  const [form, setForm] = useState({ displayName: profile.displayName, bio: profile.bio, trainingGoals: profile.trainingGoals, shareStats: profile.shareStats });
  const [saved, setSaved] = useState(false);
  const recentWeeks = useMemo(() => {
    const groups = new Map<string, { workouts: number; miles: number }>();
    workouts.filter((workout) => workout.completed).forEach((workout) => {
      const key = format(startOfWeek(parseISO(workout.scheduledDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const current = groups.get(key) || { workouts: 0, miles: 0 };
      groups.set(key, { workouts: current.workouts + 1, miles: current.miles + (workout.type === "running" ? workout.actualMiles ?? workout.plannedMiles ?? 0 : 0) });
    });
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 8);
  }, [workouts]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await onSave(form);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  const stats = [
    { label: "Workouts", value: profile.stats.workoutsCompleted, icon: Award },
    { label: "Miles run", value: Number(profile.stats.milesRun.toFixed(1)), icon: Route },
    { label: "Runs", value: profile.stats.runsCompleted, icon: Footprints },
    { label: "Strength", value: profile.stats.strengthWorkoutsCompleted, icon: Dumbbell },
    { label: "Plans finished", value: profile.stats.plansCompleted, icon: Medal },
  ];

  return <div className="page-stack">
    <section className="profile-hero card">
      <div className="avatar-large">{profile.photoUrl ? <img src={profile.photoUrl} alt="" referrerPolicy="no-referrer" /> : profile.displayName.slice(0, 1).toUpperCase()}</div>
      <div><p className="eyebrow">Your profile</p><h1>{profile.displayName}</h1><p>{profile.bio || "A quiet place for the work you keep showing up for."}</p></div>
    </section>
    <section className="profile-stats">{stats.map(({ label, value, icon: Icon }) => <article className="stat-card" key={label}><Icon size={19} /><strong>{value}</strong><span>{label}</span></article>)}</section>
    <section className="content-grid profile-content">
      <form className="card profile-form" onSubmit={submit}>
        <div className="section-title"><Target size={20} /><div><h2>About you</h2><p>Personal, useful, and pleasingly low stakes.</p></div></div>
        <label>Display name<input maxLength={80} required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
        <label>Short bio<textarea maxLength={280} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="Runner, lifter, early-morning optimist…" /></label>
        <label>Training goals<textarea maxLength={500} value={form.trainingGoals} onChange={(event) => setForm({ ...form, trainingGoals: event.target.value })} placeholder="What are you working toward?" /></label>
        <label className="share-toggle"><input type="checkbox" checked={form.shareStats} onChange={(event) => setForm({ ...form, shareStats: event.target.checked })} /><span><Share2 size={18} /><strong>Share my profile and totals</strong><small>Invited members can see your name, bio, goals, avatar, and aggregate totals—never notes or workout history.</small></span></label>
        <button disabled={busy} type="submit"><Save size={17} /> {saved ? "Saved" : "Save profile"}</button>
      </form>
      <article className="card recent-card"><h2>Recent weeks</h2>{recentWeeks.length ? recentWeeks.map(([date, totals]) => <div className="recent-row" key={date}><div><strong>Week of {prettyDate(date, "MMM d")}</strong><span>{totals.workouts} workouts</span></div><strong>{totals.miles.toFixed(1)} mi</strong></div>) : <p className="muted">Complete a workout and your weekly history will appear here.</p>}</article>
    </section>
    <section className="card calendar-settings">
      <div className="section-title"><CalendarSync size={21} /><div><h2>Google Calendar</h2><p>Send your active plan to a private, app-managed calendar.</p></div></div>
      <div className="calendar-settings-body">
        <div>
          <strong>{profile.googleCalendar ? profile.googleCalendar.calendarName : "Not connected"}</strong>
          <span>{profile.googleCalendar?.lastSyncedAt ? `Last synced ${profile.googleCalendar.lastSyncedAt.toDate().toLocaleString()}` : "Calendar access is requested only when you sync."}</span>
          {profile.googleCalendar?.needsSync && <small>Training changes are ready to sync.</small>}
          {calendarMessage && <small>{calendarMessage}</small>}
        </div>
        <div className="button-row">
          {onCalendarSync && <button disabled={calendarBusy} onClick={onCalendarSync}><CalendarSync size={17} /> {calendarBusy ? "Syncing…" : profile.googleCalendar ? "Sync now" : "Connect & sync"}</button>}
          {profile.googleCalendar && onCalendarDisconnect && <button className="secondary danger-text" disabled={calendarBusy} onClick={onCalendarDisconnect}><Trash2 size={16} /> Disconnect</button>}
        </div>
      </div>
    </section>
    <section className="history-section"><div className="section-title"><Medal size={20} /><div><h2>Your plans</h2><p>A record of the seasons you put together.</p></div></div><div className="plan-table">
      {plans.map((plan) => <div className="plan-table-row" key={plan.id}><div><strong>{plan.title}</strong><span>{prettyDate(plan.startDate, "MMM yyyy")} · {plan.status}</span></div><span>{plan.completedMiles} mi</span><span>{plan.completedWorkouts}/{plan.totalWorkouts}</span><strong>{planProgress(plan)}%</strong></div>)}
      {plans.length === 0 && <p className="muted">No plans yet.</p>}
    </div></section>
  </div>;
}
