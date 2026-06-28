import { Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { DAYS, type DayKey, type Exercise, type TemplateWorkout, type UserWorkout, type WorkoutType } from "../types";

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const WORKOUT_TYPES: Array<{ value: WorkoutType; label: string }> = [
  { value: "running", label: "Running" },
  { value: "strength", label: "Strength" },
  { value: "mobility", label: "Mobility" },
  { value: "cross_training", label: "Cross-training" },
  { value: "other", label: "Other" },
];

interface WorkoutEditorProps {
  workout: UserWorkout;
  mode?: "edit" | "create";
  onClose: () => void;
  onSave: (changes: Partial<TemplateWorkout>) => Promise<void>;
}

export function WorkoutEditor({ workout, mode = "edit", onClose, onSave }: WorkoutEditorProps) {
  const [day, setDay] = useState<DayKey>(workout.day);
  const [type, setType] = useState<WorkoutType>(workout.type);
  const [title, setTitle] = useState(workout.title);
  const [instructions, setInstructions] = useState(workout.instructions || "");
  const [plannedMiles, setPlannedMiles] = useState(workout.plannedMiles == null ? "" : String(workout.plannedMiles));
  const [plannedMinutes, setPlannedMinutes] = useState(workout.plannedMinutes == null ? "" : String(workout.plannedMinutes));
  const [exercises, setExercises] = useState<Exercise[]>(workout.exercises?.map((item) => ({ ...item })) || []);
  const [saving, setSaving] = useState(false);
  const detailsLocked = mode === "edit" && workout.completed;

  function updateExercise(index: number, field: keyof Exercise, value: string) {
    setExercises((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (detailsLocked) {
        await onSave({ day });
      } else {
        await onSave({
          day,
          type,
          title: title.trim(),
          instructions: instructions.trim() || undefined,
          plannedMiles: plannedMiles.trim() === "" ? undefined : Number(plannedMiles),
          plannedMinutes: plannedMinutes.trim() === "" ? undefined : Number(plannedMinutes),
          exercises: type === "strength"
            ? exercises
                .map((item) => ({ name: item.name.trim(), prescription: item.prescription.trim() }))
                .filter((item) => item.name && item.prescription)
            : [],
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return <div className="modal-backdrop" role="presentation">
    <section className="workout-editor" role="dialog" aria-modal="true" aria-labelledby="workout-editor-title">
      <header>
        <div><p className="eyebrow">{mode === "create" ? "One-off workout" : "Edit workout"}</p><h2 id="workout-editor-title">{mode === "create" ? "Add a workout" : workout.title}</h2></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close workout editor"><X size={20} /></button>
      </header>
      <form onSubmit={submit}>
        {detailsLocked && <div className="editor-note">This workout is complete. You can move it, but uncheck it before changing its training details.</div>}
        <div className="editor-grid">
          <label>Day<select value={day} onChange={(event) => setDay(event.target.value as DayKey)}>{DAYS.map((value) => <option key={value} value={value}>{DAY_LABELS[value]}</option>)}</select></label>
          <label>Type<select disabled={detailsLocked} value={type} onChange={(event) => setType(event.target.value as WorkoutType)}>{WORKOUT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        <label>Title<input disabled={detailsLocked} required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Instructions<textarea disabled={detailsLocked} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label>
        <div className="editor-grid">
          <label>Planned miles<input disabled={detailsLocked} type="number" min="0" step="0.1" value={plannedMiles} onChange={(event) => setPlannedMiles(event.target.value)} /></label>
          <label>Planned minutes<input disabled={detailsLocked} type="number" min="0" step="1" value={plannedMinutes} onChange={(event) => setPlannedMinutes(event.target.value)} /></label>
        </div>
        {!detailsLocked && type === "strength" && <section className="exercise-editor">
          <div className="card-row"><div><strong>Exercises</strong><small>Name and prescription</small></div><button type="button" className="secondary small-button" onClick={() => setExercises((items) => [...items, { name: "", prescription: "" }])}><Plus size={15} /> Add lift</button></div>
          {exercises.map((exercise, index) => <div className="exercise-editor-row" key={index}>
            <input aria-label={`Exercise ${index + 1} name`} placeholder="Exercise" value={exercise.name} onChange={(event) => updateExercise(index, "name", event.target.value)} />
            <input aria-label={`Exercise ${index + 1} prescription`} placeholder="3 × 8–10" value={exercise.prescription} onChange={(event) => updateExercise(index, "prescription", event.target.value)} />
            <button type="button" className="icon-button danger-text" onClick={() => setExercises((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove exercise ${index + 1}`}><Trash2 size={17} /></button>
          </div>)}
        </section>}
        <div className="editor-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button disabled={saving || !title.trim()} type="submit"><Save size={17} /> {saving ? "Saving…" : mode === "create" ? "Add workout" : "Save workout"}</button></div>
      </form>
    </section>
  </div>;
}
