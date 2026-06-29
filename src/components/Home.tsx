import {
  CalendarDays,
  CalendarSync,
  Check,
  ChevronLeft,
  ChevronRight,
  Home as HomeIcon,
  Plus,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { addDays, format, isToday, startOfWeek } from "date-fns";
import { useMemo, useState, type FormEvent } from "react";
import type { Chore, Home as HomeData, UserProfile } from "../types";

export type NewChore = Pick<Chore, "title" | "scheduledDate" | "assigneeEmail" | "notes">;

export const COMMON_CHORES = [
  "Vacuum",
  "Do laundry",
  "Sweep",
  "Mop",
  "Clean kitchen counters",
  "Do the dishes",
  "Take out the trash",
  "Clean the bathroom",
  "Change the sheets",
  "Buy groceries",
  "Water the plants",
  "Dust",
] as const;

interface HomeProps {
  home: HomeData | null;
  chores: Chore[];
  profile: UserProfile;
  busy?: boolean;
  calendarConnected?: boolean;
  calendarBusy?: boolean;
  calendarMessage?: string;
  onCreateHome: (partnerEmail: string) => Promise<void>;
  onAdd: (chore: NewChore) => Promise<void>;
  onToggle: (chore: Chore, completed: boolean) => Promise<void>;
  onDelete: (chore: Chore) => Promise<void>;
  onSyncCalendar?: () => Promise<void>;
}

function nameFromEmail(email: string) {
  return email.split("@")[0].split(/[._-]/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
}

export function Home({ home, chores, profile, busy, calendarConnected, calendarBusy, calendarMessage, onCreateHome, onAdd, onToggle, onDelete, onSyncCalendar }: HomeProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const savedChoreTitles = useMemo(() => Array.from(new Map(
    [...(home?.savedChoreTitles || []), ...chores.map((chore) => chore.title)]
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => [title.toLocaleLowerCase(), title]),
  ).values()).sort((a, b) => a.localeCompare(b)), [chores, home?.savedChoreTitles]);

  if (!home) {
    return <div className="page-stack home-setup-page">
      <section className="page-heading">
        <div><p className="eyebrow">Shared space</p><h1>Make a home together.</h1><p>Connect with your partner to share one calm, useful place for the chores that keep life moving.</p></div>
      </section>
      <section className="card home-setup-card">
        <span className="home-setup-icon"><HomeIcon size={30} /></span>
        <div><h2>Start your shared home</h2><p>Add your partner’s Google account email. Once they have app access, this Home will appear for both of you.</p></div>
        <form onSubmit={async (event) => { event.preventDefault(); await onCreateHome(partnerEmail); }}>
          <label>Partner’s email<input type="email" value={partnerEmail} onChange={(event) => setPartnerEmail(event.target.value)} placeholder="partner@example.com" required /></label>
          <button disabled={busy}><UsersRound size={17} /> {busy ? "Connecting…" : "Create our home"}</button>
        </form>
        <small>Your training plans remain private. Only chores in Home are shared.</small>
      </section>
    </div>;
  }

  const partner = home.memberEmails.find((email) => email !== profile.email) || "Partner";
  const partnerName = partner.includes("@") ? nameFromEmail(partner) : partner;
  const startKey = format(days[0], "yyyy-MM-dd");
  const endKey = format(days[6], "yyyy-MM-dd");
  const weekChores = chores.filter((chore) => chore.scheduledDate >= startKey && chore.scheduledDate <= endKey);
  const completed = weekChores.filter((chore) => chore.completed).length;
  const assigneeName = (email?: string | null) => !email ? "Either of you" : email === profile.email ? profile.displayName : partnerName;

  async function toggle(chore: Chore) {
    setSavingIds((items) => [...items, chore.id]);
    try { await onToggle(chore, !chore.completed); }
    finally { setSavingIds((items) => items.filter((id) => id !== chore.id)); }
  }

  return <div className="page-stack home-page">
    <section className="page-heading home-heading">
      <div><p className="eyebrow">{home.name}</p><h1>What keeps home humming?</h1><p>{profile.displayName} and {partnerName} · {completed} of {weekChores.length} chores done this week</p></div>
      <div className="home-heading-actions">
        <div className="home-people" aria-label={`Shared with ${partnerName}`}>
          <span title={profile.displayName}>{profile.displayName[0]?.toUpperCase()}</span>
          <span title={partnerName}>{partnerName[0]?.toUpperCase()}</span>
        </div>
        {onSyncCalendar && <button className="secondary home-calendar-button" disabled={calendarBusy} onClick={onSyncCalendar}><CalendarSync className={calendarBusy ? "spin" : ""} size={17} /> {calendarBusy ? "Syncing…" : calendarConnected ? "Sync Google Calendar" : "Connect calendar"}</button>}
        <button onClick={() => setAddingDate(today)}><Plus size={18} /> Add chore</button>
      </div>
    </section>

    {calendarMessage && <div className="calendar-status">{calendarMessage}</div>}

    <section className="card home-week-toolbar">
      <button className="icon-button" onClick={() => setWeekStart((date) => addDays(date, -7))} aria-label="Previous week"><ChevronLeft size={20} /></button>
      <div><CalendarDays size={18} /><strong>{format(days[0], "MMM d")} – {format(days[6], "MMM d, yyyy")}</strong></div>
      <button className="text-button" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</button>
      <button className="icon-button" onClick={() => setWeekStart((date) => addDays(date, 7))} aria-label="Next week"><ChevronRight size={20} /></button>
    </section>

    <section className="home-week-grid">
      {days.map((day) => {
        const date = format(day, "yyyy-MM-dd");
        const dayChores = weekChores.filter((chore) => chore.scheduledDate === date);
        return <article className={isToday(day) ? "home-day-card today" : "home-day-card"} key={date}>
          <header>
            <div><span>{format(day, "EEE")}</span><strong>{format(day, "d")}</strong></div>
            <button className="day-add-button" onClick={() => setAddingDate(date)} aria-label={`Add chore on ${format(day, "MMMM d")}`}><Plus size={15} /></button>
          </header>
          <div className="home-chore-list">
            {dayChores.map((chore) => <div className={chore.completed ? "home-chore complete" : "home-chore"} key={chore.id}>
              <button className={savingIds.includes(chore.id) ? "chore-check saving" : "chore-check"} onClick={() => toggle(chore)} aria-label={`${chore.completed ? "Reopen" : "Complete"} ${chore.title}`}>
                <span>{chore.completed && <Check size={14} />}</span>
              </button>
              <div><strong>{chore.title}</strong><small><UserRound size={11} /> {assigneeName(chore.assigneeEmail)}</small>{chore.notes && <p>{chore.notes}</p>}</div>
              <button className="chore-delete" onClick={async () => { if (window.confirm(`Remove “${chore.title}”?`)) await onDelete(chore); }} aria-label={`Remove ${chore.title}`}><Trash2 size={14} /></button>
            </div>)}
            {!dayChores.length && <button className="home-day-empty" onClick={() => setAddingDate(date)}>Nothing planned <Plus size={13} /></button>}
          </div>
        </article>;
      })}
    </section>

    {addingDate && <ChoreEditor date={addingDate} savedChoreTitles={savedChoreTitles} profile={profile} partnerEmail={partner} partnerName={partnerName} busy={busy} onClose={() => setAddingDate(null)} onSave={async (chore) => { await onAdd(chore); setAddingDate(null); }} />}
  </div>;
}

function ChoreEditor({ date, savedChoreTitles, profile, partnerEmail, partnerName, busy, onClose, onSave }: { date: string; savedChoreTitles: string[]; profile: UserProfile; partnerEmail: string; partnerName: string; busy?: boolean; onClose: () => void; onSave: (chore: NewChore) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [selectedChore, setSelectedChore] = useState("");
  const [scheduledDate, setScheduledDate] = useState(date);
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [notes, setNotes] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave({ title, scheduledDate, assigneeEmail: assigneeEmail || null, notes });
  }

  const savedKeys = new Set(savedChoreTitles.map((item) => item.toLocaleLowerCase()));
  const commonChores = COMMON_CHORES.filter((item) => !savedKeys.has(item.toLocaleLowerCase()));

  function chooseChore(value: string) {
    setSelectedChore(value);
    if (value) setTitle(value);
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="chore-editor" role="dialog" aria-modal="true" aria-labelledby="chore-editor-title">
      <header><div><p className="eyebrow">New chore</p><h2 id="chore-editor-title">Add something to the week</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
      <form onSubmit={submit}>
        <label>Choose a chore<select className="chore-picker" value={selectedChore} onChange={(event) => chooseChore(event.target.value)}>
          <option value="">Common or previously used…</option>
          {savedChoreTitles.length > 0 && <optgroup label="Your saved chores">{savedChoreTitles.map((item) => <option value={item} key={`saved-${item}`}>{item}</option>)}</optgroup>}
          {commonChores.length > 0 && <optgroup label="Common chores">{commonChores.map((item) => <option value={item} key={`common-${item}`}>{item}</option>)}</optgroup>}
        </select><small>Chores you add are saved here automatically.</small></label>
        <label>Chore name<input autoFocus value={title} onChange={(event) => { setTitle(event.target.value); if (event.target.value !== selectedChore) setSelectedChore(""); }} placeholder="Or type something new" required /></label>
        <div className="editor-grid">
          <label>Date<input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} required /></label>
          <label>Who?<select value={assigneeEmail} onChange={(event) => setAssigneeEmail(event.target.value)}><option value="">Either of us</option><option value={profile.email}>{profile.displayName}</option><option value={partnerEmail}>{partnerName}</option></select></label>
        </div>
        <label>Note <span className="optional-label">optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Bins go out after 7pm…" /></label>
        <footer><button type="button" className="secondary" onClick={onClose}>Cancel</button><button disabled={busy}><Plus size={17} /> {busy ? "Adding…" : "Add chore"}</button></footer>
      </form>
    </section>
  </div>;
}
