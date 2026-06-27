import { Dumbbell, Footprints, Lock, Route, UsersRound } from "lucide-react";
import type { SharedProfile } from "../types";
import { EmptyState } from "./Layout";

export function Members({ members }: { members: SharedProfile[] }) {
  return <div className="page-stack">
    <section className="page-heading"><div><p className="eyebrow">Members</p><h1>The training room</h1><p>Only members who choose to share appear here. The specifics stay theirs.</p></div><span className="privacy-pill"><Lock size={15} /> Private by default</span></section>
    {members.length === 0 ? <EmptyState icon={<UsersRound size={42} />} title="It’s quiet in here" body="Shared profiles will appear when members opt in." /> : <section className="members-grid">{members.map((member) => <article className="card member-card" key={member.email}>
      <div className="member-head"><div className="avatar-medium">{member.photoUrl ? <img src={member.photoUrl} alt="" referrerPolicy="no-referrer" /> : member.displayName.slice(0, 1).toUpperCase()}</div><div><h2>{member.displayName}</h2><p>{member.bio || "Training, one week at a time."}</p></div></div>
      {member.trainingGoals && <div className="goal-box"><strong>Working toward</strong><p>{member.trainingGoals}</p></div>}
      <div className="member-stats"><span><Dumbbell size={16} /><strong>{member.stats.workoutsCompleted}</strong> workouts</span><span><Route size={16} /><strong>{member.stats.milesRun.toFixed(1)}</strong> miles</span><span><Footprints size={16} /><strong>{member.stats.runsCompleted}</strong> runs</span></div>
    </article>)}</section>}
  </div>;
}
