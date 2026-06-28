import { CalendarDays, Clock3, Footprints, X } from "lucide-react";
import { useState } from "react";
import type { DayKey, PlanTemplate, TemplateWorkout } from "../types";

const DAY_NAMES: Record<DayKey, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

function workoutMeta(workout: TemplateWorkout) {
  return [
    workout.plannedMiles != null ? `${workout.plannedMiles} mi` : "",
    workout.plannedMinutes != null ? `${workout.plannedMinutes} min` : "",
  ].filter(Boolean).join(" · ");
}

export function TemplatePreview({ template, onClose }: { template: PlanTemplate; onClose: () => void }) {
  const [selectedWeek, setSelectedWeek] = useState(0);
  const week = template.weeks[selectedWeek];
  const workoutCount = template.weeks.reduce((sum, item) => sum + item.workouts.length, 0);
  const miles = template.weeks.reduce((sum, item) => sum + item.workouts.reduce((inner, workout) => inner + (workout.plannedMiles ?? 0), 0), 0);

  return <div className="modal-backdrop" role="presentation">
    <section className="template-preview" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
      <header>
        <div><p className="eyebrow">Plan preview</p><h2 id="template-preview-title">{template.title}</h2><p>{template.description}</p></div>
        <button className="icon-button" onClick={onClose} aria-label="Close plan preview"><X size={20} /></button>
      </header>

      <div className="preview-stats">
        <span><CalendarDays size={17} /><strong>{template.weeks.length}</strong> weeks</span>
        <span><Footprints size={17} /><strong>{workoutCount}</strong> workouts</span>
        <span><Clock3 size={17} /><strong>{miles}</strong> planned miles</span>
      </div>

      {template.guidance.length > 0 && <section className="preview-guidance"><strong>Plan guidance</strong><ul>{template.guidance.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}

      <nav className="preview-week-tabs" aria-label="Preview week">
        {template.weeks.map((item, index) => <button className={selectedWeek === index ? "active" : ""} key={item.weekNumber} onClick={() => setSelectedWeek(index)}>Week {item.weekNumber}</button>)}
      </nav>

      <section className="preview-week">
        <div><p className="eyebrow">Week {week.weekNumber}</p><h3>{week.summary || `Week ${week.weekNumber} schedule`}</h3></div>
        <div className="preview-workouts">
          {week.workouts.map((workout, index) => <article className="preview-workout" key={`${workout.day}-${index}`}>
            <div className="preview-workout-heading">
              <span>{DAY_NAMES[workout.day]}</span>
              <div><i className={`type-dot ${workout.type}`} /><strong>{workout.title}</strong><small>{workout.type.replace("_", " ")}{workoutMeta(workout) ? ` · ${workoutMeta(workout)}` : ""}</small></div>
            </div>
            {workout.instructions && <p>{workout.instructions}</p>}
            {workout.exercises?.length ? <div className="preview-exercises">{workout.exercises.map((exercise, exerciseIndex) => <div key={exerciseIndex}><span>{exercise.name}</span><strong>{exercise.prescription}</strong></div>)}</div> : null}
          </article>)}
        </div>
      </section>

      <footer><button onClick={onClose}>Done previewing</button></footer>
    </section>
  </div>;
}
