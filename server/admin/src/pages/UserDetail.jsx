import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmt } from "../api.js";
import { StatTile } from "../components/charts.jsx";
import { useApi } from "../useApi.js";

export function UserDetail({ me }) {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi(`/admin/users/${id}`);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function change(body, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setActionError(null);
    try {
      await api(`/admin/users/${id}`, { method: "PATCH", body });
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="error">{error.message}</div>;
  if (loading && !data) return <p className="muted">Loading…</p>;
  const { user: u, goals, activity, log } = data;
  const self = u.id === me.id;

  return (
    <>
      <p style={{ margin: 0 }}><Link to="/users">← All users</Link></p>
      <div className="page-head">
        <div>
          <h1>{u.name || u.email}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {u.email} · joined {fmt.date(u.created_at)} · last seen {fmt.ago(u.last_seen_at).toLowerCase()}
          </p>
        </div>
        <div className="toolbar">
          {u.plan === "free" ? (
            <button className="primary" disabled={busy} onClick={() => change({ plan: "premium", plan_expires_at: null })}>Give Premium</button>
          ) : (
            <button disabled={busy} onClick={() => change({ plan: "free" }, `Move ${u.email} back to the Free plan?`)}>Remove Premium</button>
          )}
          {u.status === "active" ? (
            <button className="danger" disabled={busy || self} onClick={() => change({ status: "suspended" }, `Suspend ${u.email}? They'll be signed out and can't use the app until you reactivate them.`)}>
              Suspend account
            </button>
          ) : (
            <button disabled={busy} onClick={() => change({ status: "active" })}>Reactivate account</button>
          )}
          {u.role === "user" ? (
            <button disabled={busy} onClick={() => change({ role: "admin" }, `Give ${u.email} full admin access?`)}>Make admin</button>
          ) : (
            <button disabled={busy || self} onClick={() => change({ role: "user" }, `Remove admin access from ${u.email}?`)}>Remove admin</button>
          )}
        </div>
      </div>
      {actionError && <div className="error" role="alert">{actionError}</div>}

      <section className="grid tiles">
        <StatTile label="Plan" value={u.plan === "premium" ? "Premium" : "Free"} sub={u.plan_expires_at ? `Until ${fmt.date(u.plan_expires_at)}` : u.plan === "premium" ? "No end date" : null} />
        <StatTile label="Status" value={u.status === "active" ? "Active" : "Suspended"} />
        <StatTile label="Tasks done" value={`${fmt.num(activity.tasks_done)} / ${fmt.num(activity.tasks_total)}`} />
        <StatTile label="Journal entries" value={fmt.num(activity.journal_entries)} sub="Content is private" />
        <StatTile label="AI calls" value={fmt.num(activity.ai_calls)} sub={`${fmt.compact(activity.ai_tokens)} tokens`} />
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Profile</h2>
          <dl className="kv">
            <dt>Theme</dt><dd>{u.theme}</dd>
            <dt>Occupation</dt><dd>{u.occupation || "—"}</dd>
            <dt>Wants to become</dt><dd>{u.aspiration || "—"}</dd>
            <dt>Units · currency</dt><dd>{u.units} · {u.currency}</dd>
            <dt>Timezone</dt><dd>{u.timezone}</dd>
            <dt>Onboarded</dt><dd>{u.onboarded_at ? fmt.date(u.onboarded_at) : "Not yet"}</dd>
            <dt>Role</dt><dd>{u.role}</dd>
          </dl>
        </div>
        <div className="card">
          <h2>Admin history</h2>
          {log.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              {log.map((l) => (
                <li key={l.id}>
                  <span className="muted">{fmt.dateTime(l.created_at)}</span> · {describe(l.details)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: 0 }}>No admin changes yet.</p>
          )}
        </div>
      </section>

      <section className="card" style={{ padding: 0 }}>
        <h2 style={{ padding: "18px 18px 0" }}>Goals</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Goal</th><th>Category</th><th>Status</th><th className="num">Progress</th><th>Deadline</th><th>Plan</th></tr></thead>
            <tbody>
              {goals.map((g) => (
                <tr key={g.id}>
                  <td>{g.title}</td><td>{g.category}</td><td>{g.status}</td>
                  <td className="num">{g.progress}%</td><td>{fmt.date(g.deadline)}</td>
                  <td>{g.plan_source === "ai" ? "AI" : "Template"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!goals.length && <p className="empty">No goals yet.</p>}
        </div>
      </section>
    </>
  );
}

function describe(details) {
  const after = details?.after ?? {};
  return Object.entries(after)
    .map(([k, v]) => `${k.replaceAll("_", " ")} → ${v ?? "none"}`)
    .join(", ");
}
