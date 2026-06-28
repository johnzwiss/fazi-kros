import { Archive, CalendarPlus, CheckCircle2, Clock3, Eye, Footprints } from "lucide-react";
import { useMemo, useState } from "react";
import { isMondayDate, mondayOfCurrentWeek, prettyDate } from "../date";
import { planProgress } from "../stats";
import type { PlanTemplate, UserPlan } from "../types";
import { EmptyState, ProgressBar } from "./Layout";
import { TemplatePreview } from "./TemplatePreview";

interface LibraryProps {
  templates: PlanTemplate[];
  plans: UserPlan[];
  activePlanId?: string | null;
  busy?: boolean;
  onActivate: (template: PlanTemplate, startDate: string) => Promise<void>;
}

export function Library({ templates, plans, activePlanId, busy, onActivate }: LibraryProps) {
  const [dates, setDates] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<PlanTemplate | null>(null);
  const defaultMonday = mondayOfCurrentWeek();

  async function activate(template: PlanTemplate) {
    const date = dates[template.id || ""] || defaultMonday;
    if (!isMondayDate(date)) return;
    if (activePlanId && !window.confirm("Starting this plan will archive your current active plan. Continue?")) return;
    setSelected(template.id || "");
    try { await onActivate(template, date); } finally { setSelected(null); }
  }

  return <div className="page-stack">
    <section className="page-heading"><div><p className="eyebrow">Plan library</p><h1>Choose what’s next</h1><p>Owner-published plans become your own private copy when you start one.</p></div></section>
    {templates.length === 0 ? <EmptyState icon={<Footprints size={40} />} title="No published plans yet" body="The owner can add a plan from the Admin area." /> : <section className="template-grid">
      {templates.map((template) => {
        const workoutCount = template.weeks.reduce((sum, week) => sum + week.workouts.length, 0);
        const miles = template.weeks.reduce((sum, week) => sum + week.workouts.reduce((inner, workout) => inner + (workout.plannedMiles ?? 0), 0), 0);
        const startDate = dates[template.id || ""] || defaultMonday;
        return <article className="card template-card" key={template.id}>
          <div className="template-icon"><Footprints size={22} /></div>
          <div><p className="eyebrow">{template.weeks.length} weeks · {workoutCount} workouts</p><h2>{template.title}</h2><p>{template.description}</p></div>
          <div className="template-meta"><span><Clock3 size={16} /> {template.weeks.length} weeks</span><span><Footprints size={16} /> {miles} planned miles</span></div>
          <div className="start-row"><label>Start Monday<input type="date" value={startDate} onChange={(event) => setDates((value) => ({ ...value, [template.id || ""]: event.target.value }))} /></label><div className="template-actions"><button className="secondary" onClick={() => setPreviewing(template)}><Eye size={17} /> Preview plan</button><button disabled={busy || selected === template.id || !isMondayDate(startDate)} onClick={() => activate(template)}><CalendarPlus size={17} /> {selected === template.id ? "Starting…" : "Start plan"}</button></div></div>
          {!isMondayDate(startDate) && <small className="field-error">Please choose a Monday.</small>}
        </article>;
      })}
    </section>}

    <section className="history-section">
      <div className="section-title"><Archive size={20} /><div><h2>Plan history</h2><p>Finished and archived plans stay yours.</p></div></div>
      {plans.length === 0 ? <p className="muted">No plan history yet.</p> : <div className="history-list">
        {plans.map((plan) => <article className="history-row" key={plan.id}>
          <span className={`status-icon ${plan.status}`}>{plan.status === "completed" ? <CheckCircle2 size={18} /> : <Archive size={18} />}</span>
          <div className="history-main"><strong>{plan.title}</strong><span>{prettyDate(plan.startDate, "MMM d, yyyy")} – {prettyDate(plan.endDate, "MMM d, yyyy")} · {plan.completedMiles} miles</span><ProgressBar value={planProgress(plan)} /></div>
          <div className="history-stat"><strong>{planProgress(plan)}%</strong><span>{plan.status}</span></div>
        </article>)}
      </div>}
    </section>
    {previewing && <TemplatePreview template={previewing} onClose={() => setPreviewing(null)} />}
  </div>;
}
