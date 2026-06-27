import { Archive, CheckCircle2, Clipboard, FileJson, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { AI_PLAN_PROMPT } from "../aiPrompt";
import { formatValidationErrors, parsePlanJson } from "../schema";
import type { PlanTemplate } from "../types";

interface AdminProps {
  ownerEmail: string;
  invites: string[];
  templates: PlanTemplate[];
  busy?: boolean;
  onInvite: (email: string) => Promise<void>;
  onRemoveInvite: (email: string) => Promise<void>;
  onPublish: (template: PlanTemplate, id?: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
}

export function Admin({ ownerEmail, invites, templates, busy, onInvite, onRemoveInvite, onPublish, onArchive }: AdminProps) {
  const [email, setEmail] = useState("");
  const [json, setJson] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => (json.trim() ? parsePlanJson(json) : null), [json]);
  const errors = result && !result.success ? formatValidationErrors(result.error) : [];

  async function add(event: React.FormEvent) {
    event.preventDefault();
    await onInvite(email);
    setEmail("");
  }

  async function loadExample() {
    const response = await fetch(`${import.meta.env.BASE_URL}examples/base-building-plan.json`);
    setJson(await response.text());
    setEditingId(undefined);
  }

  function edit(template: PlanTemplate) {
    const { id, status, createdAt, updatedAt, ...input } = template;
    void status; void createdAt; void updatedAt;
    setJson(JSON.stringify(input, null, 2));
    setEditingId(id);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  async function publish() {
    if (!result?.success) return;
    await onPublish(result.data, editingId);
    setJson("");
    setEditingId(undefined);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(AI_PLAN_PROMPT);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <div className="page-stack">
    <section className="page-heading"><div><p className="eyebrow">Owner controls</p><h1>Admin</h1><p>Manage the small gates and publish good plans. Your own training remains over in Training.</p></div><span className="owner-pill"><ShieldCheck size={16} /> {ownerEmail}</span></section>
    <section className="admin-grid">
      <article className="card admin-panel"><div className="section-title"><ShieldCheck size={20} /><div><h2>Invited members</h2><p>Google accounts allowed through the front door.</p></div></div>
        <form className="invite-form" onSubmit={add}><input type="email" required placeholder="runner@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /><button disabled={busy}><Plus size={17} /> Invite</button></form>
        <div className="invite-list"><div className="invite-row owner"><span><strong>{ownerEmail}</strong><small>Owner · always allowed</small></span><ShieldCheck size={18} /></div>{invites.map((item) => <div className="invite-row" key={item}><span><strong>{item}</strong><small>Invited member</small></span><button className="icon-button danger-text" onClick={() => window.confirm(`Remove ${item}?`) && onRemoveInvite(item)} aria-label={`Remove ${item}`}><Trash2 size={17} /></button></div>)}</div>
      </article>
      <article className="card prompt-panel"><div className="section-title"><Clipboard size={20} /><div><h2>Create a plan with AI</h2><p>Copy the contract, fill in your goals, paste the result below.</p></div></div><pre>{AI_PLAN_PROMPT.slice(0, 440)}…</pre><button className="secondary" onClick={copyPrompt}><Clipboard size={17} /> {copied ? "Copied" : "Copy AI prompt"}</button></article>
    </section>
    <section className="card template-admin"><div className="section-title"><FileJson size={20} /><div><h2>Published templates</h2><p>Editing a template never changes plans already copied by members.</p></div></div>
      <div className="admin-template-list">{templates.map((template) => <div className="admin-template-row" key={template.id}><span className={`status-dot ${template.status}`} /><div><strong>{template.title}</strong><small>{template.weeks.length} weeks · {template.status}</small></div><button className="secondary small-button" onClick={() => edit(template)}>Edit JSON</button>{template.status !== "archived" && <button className="icon-button danger-text" onClick={() => template.id && onArchive(template.id)} aria-label={`Archive ${template.title}`}><Archive size={17} /></button>}</div>)}</div>
    </section>
    <section className="card importer"><div className="importer-head"><div className="section-title"><Upload size={20} /><div><h2>{editingId ? "Update template" : "Import a template"}</h2><p>Paste JSON and review it before publishing.</p></div></div><button className="secondary small-button" onClick={loadExample}>Load base-building example</button></div>
      <textarea className="json-editor" spellCheck={false} value={json} onChange={(event) => setJson(event.target.value)} placeholder='{ "schemaVersion": 1, ... }' />
      {errors.length > 0 && <div className="validation-box error"><strong>Please fix {errors.length} issue{errors.length === 1 ? "" : "s"}</strong><ul>{errors.slice(0, 12).map((error) => <li key={error}>{error}</li>)}</ul></div>}
      {result?.success && <div className="validation-box success"><CheckCircle2 size={20} /><div><strong>{result.data.title}</strong><p>{result.data.weeks.length} weeks · {result.data.weeks.reduce((sum, week) => sum + week.workouts.length, 0)} workouts · JSON is ready.</p></div></div>}
      <div className="button-row"><button className="secondary" onClick={() => { setJson(""); setEditingId(undefined); }}>Clear</button><button disabled={busy || !result?.success} onClick={publish}><FileJson size={17} /> {editingId ? "Update template" : "Publish template"}</button></div>
    </section>
  </div>;
}
