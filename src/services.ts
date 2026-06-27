import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { dateForWorkout, planEndDate } from "./date";
import { db } from "./firebase";
import { applyDelta, mileageForWorkout, statDelta } from "./stats";
import {
  EMPTY_STATS,
  type PlanTemplate,
  type SharedProfile,
  type UserPlan,
  type UserProfile,
  type UserStats,
  type UserWorkout,
} from "./types";

function requireDb() {
  if (!db) throw new Error("Firebase is not configured");
  return db;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export interface AccessStatus {
  allowed: boolean;
  owner: boolean;
}

export async function checkAccess(user: User): Promise<AccessStatus> {
  const database = requireDb();
  let adminLookupUnavailable = false;

  try {
    const admin = await getDoc(doc(database, "admins", user.uid));
    if (admin.exists()) return { allowed: true, owner: true };
  } catch {
    // Supports the brief migration window before the new role-based rules are published.
    adminLookupUnavailable = true;
  }

  if (user.email) {
    try {
      const invited = await getDoc(doc(database, "allowedEmails", normalizeEmail(user.email)));
      if (invited.exists()) return { allowed: true, owner: false };
    } catch {
      // Fall through to the migration check or an unauthorized result.
    }
  }

  if (adminLookupUnavailable) {
    try {
      const existingProfile = await getDoc(doc(database, "users", user.uid));
      if (existingProfile.exists()) return { allowed: true, owner: false };
    } catch {
      // The account is not authorized under either ruleset.
    }
  }

  return { allowed: false, owner: false };
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  if (!user.email) throw new Error("Your Google account must have an email address");
  const ref = doc(requireDb(), "users", user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return { ...(snapshot.data() as UserProfile), uid: user.uid };

  const profile: UserProfile = {
    uid: user.uid,
    email: normalizeEmail(user.email),
    displayName: user.displayName || user.email.split("@")[0],
    ...(user.photoURL ? { photoUrl: user.photoURL } : {}),
    bio: "",
    trainingGoals: "",
    shareStats: false,
    activePlanId: null,
    stats: { ...EMPTY_STATS },
  };
  await setDoc(ref, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return profile;
}

export async function loadProfile(uid: string) {
  const snapshot = await getDoc(doc(requireDb(), "users", uid));
  if (!snapshot.exists()) throw new Error("Profile not found");
  return { ...(snapshot.data() as UserProfile), uid };
}

function publicProfile(profile: UserProfile): SharedProfile {
  return {
    email: normalizeEmail(profile.email),
    displayName: profile.displayName,
    ...(profile.photoUrl ? { photoUrl: profile.photoUrl } : {}),
    bio: profile.bio,
    trainingGoals: profile.trainingGoals,
    stats: profile.stats,
  };
}

export async function saveProfile(uid: string, existing: UserProfile, updates: Partial<UserProfile>) {
  const next = { ...existing, ...updates, uid, email: existing.email };
  const batch = writeBatch(requireDb());
  batch.set(doc(requireDb(), "users", uid), { ...updates, updatedAt: serverTimestamp() }, { merge: true });
  const sharedRef = doc(requireDb(), "sharedProfiles", normalizeEmail(existing.email));
  if (next.shareStats) {
    batch.set(sharedRef, { ...publicProfile(next), updatedAt: serverTimestamp() });
  } else {
    batch.delete(sharedRef);
  }
  await batch.commit();
  return next;
}

export async function loadTemplates(includeArchived = false): Promise<PlanTemplate[]> {
  const ref = collection(requireDb(), "templates");
  const snapshot = includeArchived ? await getDocs(ref) : await getDocs(query(ref, where("status", "==", "published")));
  return snapshot.docs
    .map((item) => ({ ...(item.data() as PlanTemplate), id: item.id }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function publishTemplate(template: PlanTemplate, templateId?: string) {
  const payload = {
    schemaVersion: template.schemaVersion,
    title: template.title,
    description: template.description,
    guidance: template.guidance,
    weeks: template.weeks,
    status: "published" as const,
    updatedAt: serverTimestamp(),
  };
  if (templateId) {
    await setDoc(doc(requireDb(), "templates", templateId), payload, { merge: true });
    return templateId;
  }
  const created = await addDoc(collection(requireDb(), "templates"), { ...payload, createdAt: serverTimestamp() });
  return created.id;
}

export async function archiveTemplate(templateId: string) {
  await updateDoc(doc(requireDb(), "templates", templateId), { status: "archived", updatedAt: serverTimestamp() });
}

export async function loadPlans(uid: string): Promise<UserPlan[]> {
  const snapshot = await getDocs(collection(requireDb(), "users", uid, "plans"));
  return snapshot.docs
    .map((item) => ({ ...(item.data() as UserPlan), id: item.id }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function loadPlan(uid: string, planId: string): Promise<UserPlan> {
  const snapshot = await getDoc(doc(requireDb(), "users", uid, "plans", planId));
  if (!snapshot.exists()) throw new Error("Plan not found");
  return { ...(snapshot.data() as UserPlan), id: snapshot.id };
}

export async function loadWorkouts(uid: string, planId: string): Promise<UserWorkout[]> {
  const snapshot = await getDocs(query(collection(requireDb(), "users", uid, "plans", planId, "workouts"), orderBy("scheduledDate")));
  return snapshot.docs.map((item) => ({ ...(item.data() as UserWorkout), id: item.id }));
}

export async function loadAllWorkouts(uid: string, plans: UserPlan[]) {
  const groups = await Promise.all(plans.map((plan) => loadWorkouts(uid, plan.id)));
  return groups.flat();
}

export async function activateTemplate(uid: string, template: PlanTemplate, startDate: string, currentPlanId?: string | null) {
  const database = requireDb();
  const planRef = doc(collection(database, "users", uid, "plans"));
  const planId = planRef.id;
  const workoutCount = template.weeks.reduce((sum, week) => sum + week.workouts.length, 0);
  const plannedMiles = template.weeks.reduce(
    (sum, week) => sum + week.workouts.reduce((weekSum, workout) => weekSum + (workout.plannedMiles ?? 0), 0),
    0,
  );
  const batch = writeBatch(database);
  if (currentPlanId) {
    batch.update(doc(database, "users", uid, "plans", currentPlanId), { status: "archived", updatedAt: serverTimestamp() });
  }

  const plan: Omit<UserPlan, "id"> = {
    sourceTemplateId: template.id || "",
    title: template.title,
    description: template.description,
    guidance: template.guidance,
    startDate,
    endDate: planEndDate(startDate, template.weeks.length),
    weekCount: template.weeks.length,
    status: "active",
    totalWorkouts: workoutCount,
    completedWorkouts: 0,
    plannedMiles,
    completedMiles: 0,
  };
  batch.set(planRef, { ...plan, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  template.weeks.forEach((week) => {
    batch.set(doc(database, "users", uid, "plans", planId, "weeks", String(week.weekNumber)), {
      weekNumber: week.weekNumber,
      summary: week.summary || "",
      note: "",
      updatedAt: serverTimestamp(),
    });
    week.workouts.forEach((workout, index) => {
      const workoutId = `w${week.weekNumber}-${workout.day}-${index + 1}`;
      batch.set(doc(database, "users", uid, "plans", planId, "workouts", workoutId), {
        ...workout,
        weekNumber: week.weekNumber,
        scheduledDate: dateForWorkout(startDate, week.weekNumber, workout.day),
        completed: false,
        completedAt: null,
      });
    });
  });
  batch.set(doc(database, "users", uid), { activePlanId: planId, updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
  return { ...plan, id: planId };
}

export async function setWorkoutCompletion(
  uid: string,
  email: string,
  planId: string,
  workout: UserWorkout,
  completing: boolean,
  actualMiles?: number,
) {
  const database = requireDb();
  const workoutRef = doc(database, "users", uid, "plans", planId, "workouts", workout.id);
  const planRef = doc(database, "users", uid, "plans", planId);
  const userRef = doc(database, "users", uid);
  const sharedRef = doc(database, "sharedProfiles", normalizeEmail(email));

  await runTransaction(database, async (transaction) => {
    const [workoutSnapshot, planSnapshot, userSnapshot] = await Promise.all([
      transaction.get(workoutRef),
      transaction.get(planRef),
      transaction.get(userRef),
    ]);
    if (!workoutSnapshot.exists() || !planSnapshot.exists() || !userSnapshot.exists()) throw new Error("Training data is missing");
    const storedWorkout = { ...(workoutSnapshot.data() as UserWorkout), id: workout.id };
    if (storedWorkout.completed === completing && (actualMiles == null || actualMiles === storedWorkout.actualMiles)) return;

    let delta = statDelta(storedWorkout, completing);
    if (storedWorkout.completed === completing && completing && actualMiles != null) {
      delta = { workoutsCompleted: 0, runsCompleted: 0, strengthWorkoutsCompleted: 0, milesRun: actualMiles - mileageForWorkout(storedWorkout) };
    } else if (completing && storedWorkout.type === "running" && actualMiles != null) {
      delta.milesRun = actualMiles;
    }

    const userData = userSnapshot.data() as UserProfile;
    const nextStats = applyDelta(userData.stats || EMPTY_STATS, delta);
    const planData = planSnapshot.data() as UserPlan;
    const completedDelta = storedWorkout.completed === completing ? 0 : completing ? 1 : -1;
    const nextPlanMiles = Math.max(0, Number((planData.completedMiles + delta.milesRun).toFixed(2)));

    transaction.update(workoutRef, {
      completed: completing,
      completedAt: completing ? serverTimestamp() : null,
      ...(storedWorkout.type === "running" ? { actualMiles: completing ? actualMiles ?? storedWorkout.plannedMiles ?? 0 : null } : {}),
    });
    transaction.update(planRef, {
      completedWorkouts: Math.max(0, planData.completedWorkouts + completedDelta),
      completedMiles: nextPlanMiles,
      updatedAt: serverTimestamp(),
    });
    transaction.update(userRef, { stats: nextStats, updatedAt: serverTimestamp() });
    if (userData.shareStats) {
      transaction.set(sharedRef, { ...publicProfile({ ...userData, uid, stats: nextStats }), updatedAt: serverTimestamp() }, { merge: true });
    }
  });
}

export async function saveWeekNote(uid: string, planId: string, weekNumber: number, note: string) {
  await setDoc(
    doc(requireDb(), "users", uid, "plans", planId, "weeks", String(weekNumber)),
    { note, weekNumber, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadWeekNote(uid: string, planId: string, weekNumber: number) {
  const snapshot = await getDoc(doc(requireDb(), "users", uid, "plans", planId, "weeks", String(weekNumber)));
  return snapshot.exists() ? String(snapshot.data().note || "") : "";
}

export async function finishPlan(uid: string, planId: string, completed: boolean) {
  const database = requireDb();
  const planRef = doc(database, "users", uid, "plans", planId);
  const userRef = doc(database, "users", uid);
  await runTransaction(database, async (transaction) => {
    const [planSnapshot, userSnapshot] = await Promise.all([transaction.get(planRef), transaction.get(userRef)]);
    if (!planSnapshot.exists() || !userSnapshot.exists()) throw new Error("Training data is missing");
    const plan = planSnapshot.data() as UserPlan;
    if (plan.status !== "active") return;
    const user = { ...(userSnapshot.data() as UserProfile), uid };
    const nextStats = completed ? applyDelta(user.stats || EMPTY_STATS, { plansCompleted: 1 }) : user.stats;
    transaction.update(planRef, { status: completed ? "completed" : "archived", updatedAt: serverTimestamp() });
    transaction.update(userRef, { activePlanId: null, stats: nextStats, updatedAt: serverTimestamp() });
    if (user.shareStats) {
      transaction.set(
        doc(database, "sharedProfiles", normalizeEmail(user.email)),
        { ...publicProfile({ ...user, stats: nextStats }), updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
  });
}

export async function loadMembers(): Promise<SharedProfile[]> {
  const snapshot = await getDocs(collection(requireDb(), "sharedProfiles"));
  return snapshot.docs.map((item) => item.data() as SharedProfile).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function loadInvites() {
  const snapshot = await getDocs(collection(requireDb(), "allowedEmails"));
  return snapshot.docs.map((item) => ({ email: item.id, ...(item.data() as Record<string, unknown>) }));
}

export async function addInvite(email: string) {
  const normalized = normalizeEmail(email);
  await setDoc(doc(requireDb(), "allowedEmails", normalized), { email: normalized, createdAt: serverTimestamp() });
}

export async function removeInvite(email: string) {
  const normalized = normalizeEmail(email);
  const batch = writeBatch(requireDb());
  batch.delete(doc(requireDb(), "allowedEmails", normalized));
  batch.delete(doc(requireDb(), "sharedProfiles", normalized));
  await batch.commit();
}
