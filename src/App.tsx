import { AlertTriangle, Cloud, Dumbbell, LogIn, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { Admin } from "./components/Admin";
import { Dashboard } from "./components/Dashboard";
import { Layout, ErrorBanner, LoadingScreen, type View } from "./components/Layout";
import { Library } from "./components/Library";
import { Members } from "./components/Members";
import { Profile } from "./components/Profile";
import { currentWeekNumber, dateForWorkout, mondayOfCurrentWeek, planEndDate } from "./date";
import { auth, firebaseConfigured } from "./firebase";
import { planTemplateSchema } from "./schema";
import {
  activateTemplate,
  addWorkoutToPlan,
  addInvite,
  archiveTemplate,
  checkAccess,
  ensureUserProfile,
  finishPlan,
  loadAllWorkouts,
  loadInvites,
  loadMembers,
  loadPlans,
  loadProfile,
  loadRestDays,
  loadTemplates,
  loadWeekNote,
  loadWorkouts,
  publishTemplate,
  removeInvite,
  saveProfile,
  saveWeekNote,
  setRestDayCompletion,
  setWorkoutCompletion,
  updateWorkoutDefinition,
} from "./services";
import { applyDelta, workoutCompletionDelta } from "./stats";
import {
  EMPTY_STATS,
  type DayKey,
  type PlanTemplate,
  type SharedProfile,
  type TemplateWorkout,
  type UserPlan,
  type UserProfile,
  type UserWorkout,
} from "./types";

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function App() {
  const [demoTemplate, setDemoTemplate] = useState<PlanTemplate | null>(null);
  if (!firebaseConfigured || !auth) {
    return demoTemplate ? <DemoApp template={demoTemplate} onExit={() => setDemoTemplate(null)} /> : <SetupScreen onDemo={setDemoTemplate} />;
  }
  return <AuthApp />;
}

function SetupScreen({ onDemo }: { onDemo: (template: PlanTemplate) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function preview() {
    setBusy(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}examples/base-building-plan.json`);
      const parsed = planTemplateSchema.parse(await response.json());
      onDemo({ ...parsed, id: "base-building", status: "published" });
    } catch (reason) {
      setError(messageOf(reason));
    } finally { setBusy(false); }
  }
  return <main className="auth-page">
    <section className="auth-card setup-card">
      <span className="auth-logo"><Dumbbell size={28} /></span>
      <p className="eyebrow">Training Plan Tracker</p>
      <h1>The app is built.<br />Firebase is the last mile.</h1>
      <p>Add the values from <code>.env.example</code> to <code>.env.local</code>, then restart the app to enable Google accounts and synced training data.</p>
      {error && <ErrorBanner message={error} />}
      <div className="setup-actions"><button onClick={preview} disabled={busy}><Cloud size={18} /> {busy ? "Loading…" : "Preview the app"}</button><a className="button secondary" href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">Open Firebase</a></div>
      <div className="setup-note"><ShieldCheck size={18} /><span>The preview is local and disposable. Production data is protected by the included Firestore rules.</span></div>
    </section>
  </main>;
}

function AuthApp() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => onAuthStateChanged(auth!, (next) => { setUser(next); setReady(true); }), []);

  async function login() {
    setError("");
    try { await signInWithPopup(auth!, new GoogleAuthProvider()); } catch (reason) { setError(messageOf(reason)); }
  }
  if (!ready) return <LoadingScreen label="Checking your account…" />;
  if (!user) return <main className="auth-page"><section className="auth-card"><span className="auth-logo"><Dumbbell size={28} /></span><p className="eyebrow">Training Plan Tracker</p><h1>Good work starts with a plan.</h1><p>Sign in with an invited Google account to see your training, history, and people.</p>{error && <ErrorBanner message={error} />}<button className="google-button" onClick={login}><LogIn size={19} /> Continue with Google</button><small>Private by default. Your workout data belongs to you.</small></section></main>;
  return <LiveApp user={user} onSignOut={() => signOut(auth!)} />;
}

interface AppState {
  profile: UserProfile;
  templates: PlanTemplate[];
  plans: UserPlan[];
  activePlan: UserPlan | null;
  activeWorkouts: UserWorkout[];
  allWorkouts: UserWorkout[];
  members: SharedProfile[];
  invites: string[];
}

function optimisticWorkoutState(
  current: AppState,
  workout: UserWorkout,
  completing: boolean,
  actualMiles?: number,
): AppState {
  if (!current.activePlan) return current;
  const delta = workoutCompletionDelta(workout, completing, actualMiles);
  const completedDelta = workout.completed === completing ? 0 : completing ? 1 : -1;
  const nextWorkout: UserWorkout = {
    ...workout,
    completed: completing,
    ...(workout.type === "running"
      ? { actualMiles: completing ? actualMiles ?? workout.plannedMiles ?? 0 : undefined }
      : {}),
  };
  const nextPlan = {
    ...current.activePlan,
    completedWorkouts: Math.max(0, current.activePlan.completedWorkouts + completedDelta),
    completedMiles: Math.max(0, Number((current.activePlan.completedMiles + delta.milesRun).toFixed(2))),
  };
  const matchesWorkout = (item: UserWorkout) => item.id === workout.id && item.scheduledDate === workout.scheduledDate;
  const nextStats = applyDelta(current.profile.stats, delta);

  return {
    ...current,
    profile: { ...current.profile, stats: nextStats },
    activePlan: nextPlan,
    plans: current.plans.map((plan) => plan.id === nextPlan.id ? nextPlan : plan),
    activeWorkouts: current.activeWorkouts.map((item) => matchesWorkout(item) ? nextWorkout : item),
    allWorkouts: current.allWorkouts.map((item) => matchesWorkout(item) ? nextWorkout : item),
    members: current.profile.shareStats
      ? current.members.map((member) => member.email === current.profile.email ? { ...member, stats: nextStats } : member)
      : current.members,
  };
}

function editedWorkoutState(current: AppState, workout: UserWorkout, changes: Partial<TemplateWorkout>): AppState {
  if (!current.activePlan) return current;
  const nextWorkout: UserWorkout = {
    ...workout,
    ...changes,
    scheduledDate: changes.day
      ? dateForWorkout(current.activePlan.startDate, workout.weekNumber, changes.day)
      : workout.scheduledDate,
  };
  if (Object.hasOwn(changes, "instructions") && !changes.instructions) delete nextWorkout.instructions;
  if (Object.hasOwn(changes, "plannedMiles") && changes.plannedMiles == null) delete nextWorkout.plannedMiles;
  if (Object.hasOwn(changes, "plannedMinutes") && changes.plannedMinutes == null) delete nextWorkout.plannedMinutes;
  if (Object.hasOwn(changes, "exercises") && !changes.exercises?.length) delete nextWorkout.exercises;

  const plannedMilesDelta = (nextWorkout.plannedMiles ?? 0) - (workout.plannedMiles ?? 0);
  const nextPlan = {
    ...current.activePlan,
    plannedMiles: Math.max(0, Number((current.activePlan.plannedMiles + plannedMilesDelta).toFixed(2))),
  };
  const matchesWorkout = (item: UserWorkout) => item.id === workout.id && item.scheduledDate === workout.scheduledDate;
  return {
    ...current,
    activePlan: nextPlan,
    plans: current.plans.map((plan) => plan.id === nextPlan.id ? nextPlan : plan),
    activeWorkouts: current.activeWorkouts.map((item) => matchesWorkout(item) ? nextWorkout : item),
    allWorkouts: current.allWorkouts.map((item) => matchesWorkout(item) ? nextWorkout : item),
  };
}

function addedWorkoutState(current: AppState, workout: UserWorkout): AppState {
  if (!current.activePlan) return current;
  const nextPlan = {
    ...current.activePlan,
    totalWorkouts: current.activePlan.totalWorkouts + 1,
    plannedMiles: Number((current.activePlan.plannedMiles + (workout.plannedMiles ?? 0)).toFixed(2)),
  };
  const byDate = (a: UserWorkout, b: UserWorkout) => a.scheduledDate.localeCompare(b.scheduledDate);
  return {
    ...current,
    activePlan: nextPlan,
    plans: current.plans.map((plan) => plan.id === nextPlan.id ? nextPlan : plan),
    activeWorkouts: [...current.activeWorkouts, workout].sort(byDate),
    allWorkouts: [...current.allWorkouts, workout].sort(byDate),
  };
}

function LiveApp({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) {
  const [view, setView] = useState<View>("dashboard");
  const [state, setState] = useState<AppState | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [owner, setOwner] = useState(false);
  const [week, setWeek] = useState(1);
  const [note, setNote] = useState("");
  const [restDays, setRestDays] = useState<Partial<Record<DayKey, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh(asOwner = owner) {
    const profile = await loadProfile(user.uid);
    const [templates, plans, members, invites] = await Promise.all([
      loadTemplates(asOwner),
      loadPlans(user.uid),
      loadMembers(),
      asOwner ? loadInvites().then((items) => items.map((item) => String(item.email))) : Promise.resolve([]),
    ]);
    const activePlan = profile.activePlanId ? plans.find((plan) => plan.id === profile.activePlanId) || null : null;
    const [activeWorkouts, allWorkouts] = await Promise.all([
      activePlan ? loadWorkouts(user.uid, activePlan.id) : Promise.resolve([]),
      loadAllWorkouts(user.uid, plans),
    ]);
    const selectedWeek = activePlan ? currentWeekNumber(activePlan.startDate, activePlan.weekCount) : 1;
    setWeek(selectedWeek);
    const [weekNote, savedRestDays] = activePlan
      ? await Promise.all([
        loadWeekNote(user.uid, activePlan.id, selectedWeek),
        loadRestDays(user.uid, activePlan.id, selectedWeek),
      ])
      : ["", {}];
    setNote(weekNote);
    setRestDays(savedRestDays);
    setState({ profile, templates, plans, activePlan, activeWorkouts, allWorkouts, members, invites });
  }

  useEffect(() => {
    (async () => {
      try {
        const access = await checkAccess(user);
        setAuthorized(access.allowed);
        setOwner(access.owner);
        if (!access.allowed) return;
        await ensureUserProfile(user);
        await refresh(access.owner);
      } catch (reason) { setError(messageOf(reason)); }
    })();
  }, [user.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function perform(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (reason) { setError(messageOf(reason)); } finally { setBusy(false); }
  }

  async function selectWeek(next: number) {
    setWeek(next);
    if (state?.activePlan) {
      const [weekNote, savedRestDays] = await Promise.all([
        loadWeekNote(user.uid, state.activePlan.id, next),
        loadRestDays(user.uid, state.activePlan.id, next),
      ]);
      setNote(weekNote);
      setRestDays(savedRestDays);
    }
  }

  async function toggleWorkout(workout: UserWorkout, complete: boolean, actualMiles?: number) {
    if (!state?.activePlan) return;
    setError("");
    setState((current) => current ? optimisticWorkoutState(current, workout, complete, actualMiles) : current);
    try {
      await setWorkoutCompletion(user.uid, state.profile.email, state.activePlan.id, workout, complete, actualMiles);
    } catch (reason) {
      setError(messageOf(reason));
      await refresh();
    }
  }

  async function editWorkout(workout: UserWorkout, changes: Partial<TemplateWorkout>) {
    if (!state?.activePlan) return;
    setError("");
    setState((current) => current ? editedWorkoutState(current, workout, changes) : current);
    try {
      await updateWorkoutDefinition(user.uid, state.activePlan.id, workout.id, changes);
    } catch (reason) {
      setError(messageOf(reason));
      await refresh();
    }
  }

  async function addWorkout(weekNumber: number, workout: TemplateWorkout) {
    if (!state?.activePlan) return;
    setError("");
    try {
      const created = await addWorkoutToPlan(user.uid, state.activePlan.id, weekNumber, workout);
      setState((current) => current ? addedWorkoutState(current, created) : current);
      if (restDays[workout.day]) {
        setRestDays((current) => ({ ...current, [workout.day]: false }));
        await setRestDayCompletion(user.uid, state.activePlan.id, weekNumber, workout.day, false);
      }
    } catch (reason) {
      setError(messageOf(reason));
      throw reason;
    }
  }

  async function toggleRestDay(day: DayKey, complete: boolean) {
    if (!state?.activePlan) return;
    const previous = restDays[day] || false;
    setRestDays((current) => ({ ...current, [day]: complete }));
    try {
      await setRestDayCompletion(user.uid, state.activePlan.id, week, day, complete);
    } catch (reason) {
      setRestDays((current) => ({ ...current, [day]: previous }));
      setError(messageOf(reason));
    }
  }

  if (authorized === false) return <main className="auth-page"><section className="auth-card"><AlertTriangle size={34} /><h1>This account isn’t invited.</h1><p>Ask the owner to add <strong>{user.email}</strong>, then try again.</p><button onClick={onSignOut}>Use another account</button></section></main>;
  if (!state) {
    if (error) {
      return <main className="auth-page"><section className="auth-card"><AlertTriangle size={34} /><h1>We couldn’t load your training.</h1><ErrorBanner message={error} /><p>Your Google sign-in worked, but Firebase rejected or could not complete the first data request.</p><div className="setup-actions"><button onClick={() => window.location.reload()}>Try again</button><button className="secondary" onClick={onSignOut}>Sign out</button></div></section></main>;
    }
    return <LoadingScreen />;
  }

  const publishedTemplates = state.templates.filter((template) => template.status !== "archived");
  const common = { view, onView: setView, name: state.profile.displayName, photoUrl: state.profile.photoUrl, owner, onSignOut };
  return <Layout {...common}>{error && <ErrorBanner message={error} />}
    {view === "dashboard" && <Dashboard plan={state.activePlan} workouts={state.activeWorkouts} note={note} restDays={restDays} busy={busy} onOpenLibrary={() => setView("library")} onWeekChange={selectWeek}
      onToggle={toggleWorkout}
      onAdd={addWorkout}
      onEdit={editWorkout}
      onToggleRest={toggleRestDay}
      onBulk={(items, complete) => perform(async () => { for (const workout of items) await setWorkoutCompletion(user.uid, state.profile.email, state.activePlan!.id, workout, complete, workout.plannedMiles); await refresh(); })}
      onNote={(value) => perform(async () => { await saveWeekNote(user.uid, state.activePlan!.id, week, value); setNote(value); })}
      onFinish={(completed) => perform(async () => { if (!window.confirm(`${completed ? "Finish" : "Archive"} this plan?`)) return; await finishPlan(user.uid, state.activePlan!.id, completed); await refresh(); setView("library"); })}
    />}
    {view === "library" && <Library templates={publishedTemplates} plans={state.plans} activePlanId={state.profile.activePlanId} busy={busy} onActivate={(template, start) => perform(async () => { await activateTemplate(user.uid, template, start, state.profile.activePlanId); await refresh(); setView("dashboard"); })} />}
    {view === "members" && <Members members={state.members} />}
    {view === "profile" && <Profile profile={state.profile} plans={state.plans} workouts={state.allWorkouts} busy={busy} onSave={(updates) => perform(async () => { await saveProfile(user.uid, state.profile, updates); await refresh(); })} />}
    {view === "admin" && owner && <Admin ownerEmail={state.profile.email} invites={state.invites} templates={state.templates} busy={busy}
      onInvite={(email) => perform(async () => { await addInvite(email); await refresh(); })}
      onRemoveInvite={(email) => perform(async () => { await removeInvite(email); await refresh(); })}
      onPublish={(template, id) => perform(async () => { await publishTemplate(template, id); await refresh(); })}
      onArchive={(id) => perform(async () => { await archiveTemplate(id); await refresh(); })}
    />}
  </Layout>;
}

function makeDemoPlan(template: PlanTemplate, startDate: string): { plan: UserPlan; workouts: UserWorkout[] } {
  const workouts = template.weeks.flatMap((week) => week.workouts.map((workout, index) => ({ ...workout, id: `w${week.weekNumber}-${workout.day}-${index + 1}`, weekNumber: week.weekNumber, scheduledDate: dateForWorkout(startDate, week.weekNumber, workout.day), completed: false })));
  return {
    plan: {
      id: `demo-${Date.now()}`,
      sourceTemplateId: template.id || "demo",
      title: template.title,
      description: template.description,
      guidance: template.guidance,
      startDate,
      endDate: planEndDate(startDate, template.weeks.length),
      weekCount: template.weeks.length,
      status: "active",
      totalWorkouts: workouts.length,
      completedWorkouts: 0,
      plannedMiles: workouts.reduce((sum, item) => sum + (item.plannedMiles ?? 0), 0),
      completedMiles: 0,
    },
    workouts,
  };
}

function DemoApp({ template, onExit }: { template: PlanTemplate; onExit: () => void }) {
  const initial = useMemo(() => makeDemoPlan(template, mondayOfCurrentWeek()), [template]);
  const [view, setView] = useState<View>("dashboard");
  const [profile, setProfile] = useState<UserProfile>({ uid: "demo", email: "owner@example.com", displayName: "Alex Runner", bio: "Runner, lifter, and enthusiastic keeper of tiny promises.", trainingGoals: "Build a durable aerobic base and stay strong enough for everything else.", shareStats: true, activePlanId: initial.plan.id, stats: { ...EMPTY_STATS } });
  const [templates, setTemplates] = useState<PlanTemplate[]>([template]);
  const [plans, setPlans] = useState<UserPlan[]>([initial.plan]);
  const [activePlan, setActivePlan] = useState<UserPlan | null>(initial.plan);
  const [workouts, setWorkouts] = useState<UserWorkout[]>(initial.workouts);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [demoRestDays, setDemoRestDays] = useState<Record<number, Partial<Record<DayKey, boolean>>>>({});
  const [week, setWeek] = useState(currentWeekNumber(initial.plan.startDate, initial.plan.weekCount));
  const [invites, setInvites] = useState(["friend@example.com"]);
  const [members, setMembers] = useState<SharedProfile[]>([
    { email: "sam@example.com", displayName: "Sam Miles", bio: "Trail-curious and learning to love easy days.", trainingGoals: "A comfortable fall half marathon.", stats: { workoutsCompleted: 42, runsCompleted: 27, strengthWorkoutsCompleted: 15, milesRun: 138.6, plansCompleted: 1 } },
  ]);

  async function toggle(workout: UserWorkout, complete: boolean, actualMiles?: number) {
    if (workout.completed === complete && actualMiles === workout.actualMiles) return;
    const nextWorkout = { ...workout, completed: complete, actualMiles: workout.type === "running" && complete ? actualMiles ?? workout.plannedMiles : undefined };
    const delta = workoutCompletionDelta(workout, complete, actualMiles);
    const nextStats = applyDelta(profile.stats, delta);
    setProfile((value) => ({ ...value, stats: nextStats }));
    setWorkouts((items) => items.map((item) => item.id === workout.id ? nextWorkout : item));
    setPlans((items) => items.map((plan) => plan.id === activePlan?.id ? { ...plan, completedWorkouts: Math.max(0, plan.completedWorkouts + (workout.completed === complete ? 0 : complete ? 1 : -1)), completedMiles: Math.max(0, Number((plan.completedMiles + delta.milesRun).toFixed(2))) } : plan));
    setActivePlan((plan) => plan ? { ...plan, completedWorkouts: Math.max(0, plan.completedWorkouts + (workout.completed === complete ? 0 : complete ? 1 : -1)), completedMiles: Math.max(0, Number((plan.completedMiles + delta.milesRun).toFixed(2))) } : null);
  }

  async function editDemoWorkout(workout: UserWorkout, changes: Partial<TemplateWorkout>) {
    if (!activePlan) return;
    const nextWorkout: UserWorkout = {
      ...workout,
      ...changes,
      scheduledDate: changes.day ? dateForWorkout(activePlan.startDate, workout.weekNumber, changes.day) : workout.scheduledDate,
    };
    const plannedMilesDelta = (nextWorkout.plannedMiles ?? 0) - (workout.plannedMiles ?? 0);
    setWorkouts((items) => items.map((item) => item.id === workout.id ? nextWorkout : item));
    setPlans((items) => items.map((plan) => plan.id === activePlan.id ? { ...plan, plannedMiles: plan.plannedMiles + plannedMilesDelta } : plan));
    setActivePlan((plan) => plan ? { ...plan, plannedMiles: plan.plannedMiles + plannedMilesDelta } : plan);
  }

  async function addDemoWorkout(weekNumber: number, workout: TemplateWorkout) {
    if (!activePlan) return;
    const created: UserWorkout = {
      id: `one-off-${Date.now()}`,
      ...workout,
      weekNumber,
      scheduledDate: dateForWorkout(activePlan.startDate, weekNumber, workout.day),
      completed: false,
    };
    setWorkouts((items) => [...items, created].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)));
    setPlans((items) => items.map((plan) => plan.id === activePlan.id ? { ...plan, totalWorkouts: plan.totalWorkouts + 1, plannedMiles: plan.plannedMiles + (workout.plannedMiles ?? 0) } : plan));
    setActivePlan((plan) => plan ? { ...plan, totalWorkouts: plan.totalWorkouts + 1, plannedMiles: plan.plannedMiles + (workout.plannedMiles ?? 0) } : plan);
    setDemoRestDays((items) => ({ ...items, [weekNumber]: { ...items[weekNumber], [workout.day]: false } }));
  }

  async function saveDemoProfile(updates: Partial<UserProfile>) {
    const next = { ...profile, ...updates };
    setProfile(next);
    setMembers((items) => {
      const without = items.filter((item) => item.email !== next.email);
      return next.shareStats ? [...without, { email: next.email, displayName: next.displayName, photoUrl: next.photoUrl, bio: next.bio, trainingGoals: next.trainingGoals, stats: next.stats }] : without;
    });
  }

  const layout = { view, onView: setView, name: profile.displayName, photoUrl: profile.photoUrl, owner: true, demo: true, onSignOut: onExit };
  return <Layout {...layout}>
    {view === "dashboard" && <Dashboard plan={activePlan} workouts={workouts} note={notes[week] || ""} restDays={demoRestDays[week] || {}} onOpenLibrary={() => setView("library")} onWeekChange={setWeek} onToggle={toggle} onAdd={addDemoWorkout} onEdit={editDemoWorkout} onToggleRest={async (day, complete) => setDemoRestDays((items) => ({ ...items, [week]: { ...items[week], [day]: complete } }))} onBulk={async (items, complete) => { for (const item of items) await toggle(item, complete, item.plannedMiles); }} onNote={async (value) => setNotes((items) => ({ ...items, [week]: value }))} onFinish={async (completed) => { if (!activePlan) return; const finished = { ...activePlan, status: completed ? "completed" as const : "archived" as const }; setPlans((items) => items.map((item) => item.id === finished.id ? finished : item)); setActivePlan(null); setProfile((item) => ({ ...item, activePlanId: null, stats: completed ? { ...item.stats, plansCompleted: item.stats.plansCompleted + 1 } : item.stats })); setView("library"); }} />}
    {view === "library" && <Library templates={templates.filter((item) => item.status !== "archived")} plans={plans} activePlanId={profile.activePlanId} onActivate={async (selected, start) => { const next = makeDemoPlan(selected, start); setPlans((items) => [next.plan, ...items.map((item) => item.status === "active" ? { ...item, status: "archived" as const } : item)]); setActivePlan(next.plan); setWorkouts(next.workouts); setProfile((item) => ({ ...item, activePlanId: next.plan.id })); setView("dashboard"); }} />}
    {view === "members" && <Members members={members} />}
    {view === "profile" && <Profile profile={profile} plans={plans} workouts={workouts} onSave={saveDemoProfile} />}
    {view === "admin" && <Admin ownerEmail="owner@example.com" invites={invites} templates={templates} onInvite={async (email) => setInvites((items) => [...items, email.trim().toLowerCase()])} onRemoveInvite={async (email) => setInvites((items) => items.filter((item) => item !== email))} onPublish={async (next, id) => setTemplates((items) => id ? items.map((item) => item.id === id ? { ...next, id, status: "published" } : item) : [...items, { ...next, id: `demo-template-${Date.now()}`, status: "published" }])} onArchive={async (id) => setTemplates((items) => items.map((item) => item.id === id ? { ...item, status: "archived" } : item))} />}
  </Layout>;
}
