import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fmt } from "../api.js";
import { Breakdown, DailyBars, StatTile } from "../components/charts.jsx";
import { ACTIVITY_LABELS, activityLabel, describeMeta } from "../components/UserActivity.jsx";
import { useApi } from "../useApi.js";

const DAY_OPTIONS = [1, 7, 30, 90];

export function Activity() {
  const summary = useApi("/admin/activity/summary?days=30");
  const s = summary.data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>What people do in the app. Never includes what they write.</p>
        </div>
      </div>
      {summary.error && <div className="error">{summary.error.message}</div>}

      <section className="grid tiles">
        <StatTile label="Active today" value={s ? fmt.num(s.totals.active_today) : "—"} />
        <StatTile label="Active, 7 days" value={s ? fmt.num(s.totals.active_7d) : "—"} />
        <StatTile label="Active, 30 days" value={s ? fmt.num(s.totals.active_30d) : "—"} />
        <StatTile label="Events, 30 days" value={s ? fmt.compact(s.totals.events_30d) : "—"} />
      </section>

      <section className="card">
        <h2>Daily active users</h2>
        {s ? <DailyBars data={s.dau} valueKey="count" label="Active users" /> : <p className="empty">Loading…</p>}
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Sign-up funnel</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>People who signed up in the last 30 days, and how far they got.</p>
          {s && (
            <Breakdown
              rows={s.funnel[0].count ? s.funnel.map((f) => ({ label: `${f.label} · ${f.pct}%`, count: f.count })) : []}
              emptyText="No sign-ups in the last 30 days, so there is no funnel yet."
            />
          )}
        </div>
        <div className="card">
          <h2>Events by type</h2>
          {s && (
            <Breakdown
              rows={s.byType.map((t) => ({ label: activityLabel(t.type), count: t.count }))}
              emptyText="No activity in the last 30 days."
            />
          )}
        </div>
      </section>

      {s && s.topUsers.length > 0 && (
        <section className="card" style={{ padding: 0 }}>
          <h2 style={{ padding: "18px 18px 0" }}>Most active users</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th className="num">Events, 30 days</th><th>Last active</th></tr></thead>
              <tbody>
                {s.topUsers.map((u) => (
                  <tr key={u.user_id}>
                    <td><Link to={`/users/${u.user_id}`}>{u.email}</Link></td>
                    <td className="num">{fmt.num(u.count)}</td>
                    <td>{fmt.ago(u.last_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Feed />
    </>
  );
}

function Feed() {
  const [params, setParams] = useSearchParams();
  const [user, setUser] = useState(params.get("user") ?? "");
  const page = Number(params.get("page") || 1);
  const days = params.get("days") || "7";

  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("user") ?? "") !== user) update({ user, page: 1 });
    }, 300);
    return () => clearTimeout(id);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(next) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) (v ? p.set(k, v) : p.delete(k));
    setParams(p, { replace: true });
  }

  const qs = new URLSearchParams({ days, page: String(page) });
  if (params.get("type")) qs.set("type", params.get("type"));
  if (params.get("user")) qs.set("user", params.get("user"));
  const { data, error, loading } = useApi(`/admin/activity?${qs}`);
  const types = [...new Set([...Object.keys(ACTIVITY_LABELS), ...(data?.types ?? [])])];
  const filtered = Boolean(params.get("type") || params.get("user"));

  return (
    <section className="card" style={{ padding: 0 }}>
      <div style={{ padding: "18px 18px 12px", display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Activity feed</h2>
        <div className="toolbar">
          <input type="search" aria-label="Search by user" placeholder="Search by email or user id" value={user} onChange={(e) => setUser(e.target.value)} />
          <select aria-label="Event type" value={params.get("type") ?? ""} onChange={(e) => update({ type: e.target.value, page: 1 })}>
            <option value="">All events</option>
            {types.map((t) => (
              <option key={t} value={t}>{activityLabel(t)}</option>
            ))}
          </select>
          <select aria-label="Time range" value={days} onChange={(e) => update({ days: e.target.value, page: 1 })}>
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>{d === 1 ? "Last 24 hours" : `Last ${d} days`}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <div className="error" style={{ margin: "0 18px 18px" }}>{error.message}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>User</th><th>What</th><th>Details</th><th>When</th></tr></thead>
          <tbody>
            {data?.events.map((e) => (
              <tr key={e.id}>
                <td>{e.user_id ? <Link to={`/users/${e.user_id}`}>{e.email ?? "Deleted user"}</Link> : <span className="muted">Unknown</span>}</td>
                <td>{activityLabel(e.type)}</td>
                <td className="muted">{describeMeta(e.meta) || "—"}</td>
                <td title={fmt.dateTime(e.created_at)}>{fmt.ago(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && !data.events.length && (
          <p className="empty">
            {filtered ? "No events match these filters. Try a longer time range or clear the search." : "No activity in this time range. Events appear as people use the app."}
          </p>
        )}
        {loading && !data && <p className="empty">Loading…</p>}
      </div>
      {(page > 1 || data?.hasMore) && (
        <div className="toolbar" style={{ padding: 18 }}>
          <button disabled={page <= 1} onClick={() => update({ page: page - 1 })}>Previous</button>
          <span className="muted">Page {page}</span>
          <button disabled={!data?.hasMore} onClick={() => update({ page: page + 1 })}>Next</button>
        </div>
      )}
    </section>
  );
}
