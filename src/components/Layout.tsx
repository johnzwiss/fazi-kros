import {
  BookOpen,
  Dumbbell,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";

export type View = "dashboard" | "library" | "members" | "profile" | "admin";

interface LayoutProps {
  children: ReactNode;
  view: View;
  onView: (view: View) => void;
  name: string;
  photoUrl?: string;
  owner: boolean;
  demo?: boolean;
  onSignOut?: () => void;
}

const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof Dumbbell }> = [
  { id: "dashboard", label: "Training", icon: Dumbbell },
  { id: "library", label: "Plans", icon: BookOpen },
  { id: "members", label: "Members", icon: UsersRound },
  { id: "profile", label: "Profile", icon: UserRound },
];

export function Layout({ children, view, onView, name, photoUrl, owner, demo, onSignOut }: LayoutProps) {
  const items = owner ? [...NAV_ITEMS, { id: "admin" as const, label: "Admin", icon: ShieldCheck }] : NAV_ITEMS;
  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => onView("dashboard")} aria-label="Training Plan Tracker home">
          <span className="brand-mark"><Dumbbell size={20} /></span>
          <span><strong>Training Plan</strong><small>Tracker</small></span>
        </button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {items.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? "nav-link active" : "nav-link"} onClick={() => onView(id)}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>
        <div className="account-chip">
          {photoUrl ? <img src={photoUrl} alt="" referrerPolicy="no-referrer" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
          <div><strong>{name}</strong><small>{demo ? "Demo preview" : owner ? "Owner" : "Member"}</small></div>
          {onSignOut && <button className="icon-button" onClick={onSignOut} aria-label="Sign out"><LogOut size={17} /></button>}
        </div>
      </header>
      {demo && <div className="demo-banner">Demo preview · Connect Firebase to save and sync real accounts.</div>}
      <main className="page-container">{children}</main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => onView(id)}>
            <Icon size={20} /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export function LoadingScreen({ label = "Loading your training…" }: { label?: string }) {
  return <div className="center-state"><LoaderCircle className="spin" size={32} /><p>{label}</p></div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="alert error" role="alert">{message}</div>;
}

export function ProgressBar({ value }: { value: number }) {
  return <div className="progress-track" aria-label={`${value}% complete`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return <section className="empty-state">{icon}<h2>{title}</h2><p>{body}</p>{action}</section>;
}
