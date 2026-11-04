import { Fragment, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, fmt } from "../api.js";
import { DailyBars, StatTile } from "../components/charts.jsx";
import { useApi } from "../useApi.js";

const SOURCE_LABEL = { server: "Server", app: "App", admin: "Admin" };
const truncate = (s, n = 120) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function Errors() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);
  const status = params.get("status") || "open";

  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update({ q });
    }, 300);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(next) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) (v ? p.set(k, v) : p.delete(k));
    setParams(p, { replace: true });
  }

  const qs = new URLSearchParams({ status, days: params.get("days") || "30" });
  if (params.get("source")) qs.set("source", params.get("source"));
  if (params.get("q")) qs.set("q", params.get("q"));
  const summary = useApi("/admin/errors/summary");
  const list = useApi(`/admin/errors?${qs}`);
  const filtered = Boolean(params.get("source") || params.get("q"));

  async function setResolved(fp, resolved) {
    setBusy(fp);
    setActionError(null);
    try {
      await api(`/admin/errors/${fp}/${resolved ? "resolve" : "reopen"}`, { method: "POST" });
      list.reload();
      summary.reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const s = summary.data;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Error logs</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Crashes and server errors, grouped when they share a cause.</p>
        </div>
      </div>
      {summary.error && <div className="error">{summary.error.message}</div>}

      <section className="grid tiles">
        <StatTile label="Open error groups" value={s ? fmt.num(s.open_groups) : "—"} />
        <StatTile label="Errors, 24 hours" value={s ? fmt.num(s.errors_24h) : "—"} />
        <StatTile label="Errors, 30 days" value={s ? fmt.num(s.errors_30d) : "—"} />
      </section>

      <section className="card">
        <h2>Errors per day</h2>
        {s ? <DailyBars data={s.perDay} valueKey="count" label="Errors" /> : <p className="empty">Loading…</p>}
      </section>

      <div className="toolbar">
        <input type="search" aria-label="Search errors" placeholder="Search message or path" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Source" value={params.get("source") ?? ""} onChange={(e) => update({ source: e.target.value })}>
          <option value="">All sources</option>
          <option value="server">Server</option>
          <option value="app">App</option>
          <option value="admin">Admin</option>
        </select>
        <select aria-label="Status" value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        <select aria-label="Time range" value={params.get("days") || "30"} onChange={(e) => update({ days: e.target.value })}>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {actionError && <div className="error" role="alert">{actionError}</div>}
      {list.error && <div className="error">{list.error.message}</div>}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Error</th><th>Source</th><th className="num">Count</th><th className="num">Users</th><th>Last seen</th><th><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {list.data?.groups.map((g) => (
                <Fragment key={g.fingerprint}>
                  <tr style={{ cursor: "pointer" }} onClick={() => setOpen(open === g.fingerprint ? null : g.fingerprint)}>
                    <td>
                      <button
                        type="button"
                        aria-expanded={open === g.fingerprint}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(open === g.fingerprint ? null : g.fingerprint);
                        }}
                        style={{ all: "unset", cursor: "pointer", fontWeight: 600, overflowWrap: "anywhere" }}
                      >
                        {truncate(g.message)}
                      </button>
                      {g.path && <div className="muted" style={{ fontSize: 12 }}>{truncate(g.path, 80)}</div>}
                    </td>
                    <td>
                      <span className="badge">{SOURCE_LABEL[g.source] ?? g.source}</span>
                      {g.level === "fatal" && <span className="badge suspended" style={{ marginLeft: 6 }}>Fatal</span>}
                    </td>
                    <td className="num">{fmt.num(g.count)}</td>
                    <td className="num">{fmt.num(g.users)}</td>
                    <td title={fmt.dateTime(g.last_seen)}>{fmt.ago(g.last_seen)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {g.resolved ? (
                        <button disabled={busy === g.fingerprint} onClick={() => setResolved(g.fingerprint, false)}>Reopen</button>
                      ) : (
                        <button className="primary" disabled={busy === g.fingerprint} onClick={() => setResolved(g.fingerprint, true)}>
                          Mark as resolved
                        </button>
                      )}
                    </td>
                  </tr>
                  {open === g.fingerprint && (
                    <tr>
                      <td colSpan={6} style={{ background: "var(--surface-2)" }}>
                        <ErrorDetail fingerprint={g.fingerprint} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {list.data && !list.data.groups.length && (
            <p className="empty">
              {filtered
                ? "No errors match these filters. Try another source or clear the search."
                : status === "open"
                  ? "No open errors. New crashes and server errors will appear here."
                  : "No errors in this time range."}
            </p>
          )}
          {list.loading && !list.data && <p className="empty">Loading…</p>}
        </div>
      </div>
    </>
  );
}

function ErrorDetail({ fingerprint }) {
  const { data, error, loading } = useApi(`/admin/errors/${fingerprint}`);
  if (error) return <div className="error">{error.message}</div>;
  if (loading && !data) return <p className="muted">Loading…</p>;
  const { group, occurrences } = data;
  return (
    <div style={{ display: "grid", gap: 12, padding: "4px 0" }}>
      <dl className="kv">
        <dt>Message</dt><dd>{group.message}</dd>
        <dt>First seen</dt><dd>{fmt.dateTime(group.first_seen)}</dd>
        <dt>Last seen</dt><dd>{fmt.dateTime(group.last_seen)}</dd>
        <dt>Total</dt><dd>{fmt.num(group.count)} times · {fmt.num(group.users)} users</dd>
        {group.resolved && <><dt>Resolved</dt><dd>{fmt.dateTime(group.resolved_at)}</dd></>}
      </dl>
      <h3 style={{ margin: 0, fontSize: 14 }}>Latest {occurrences.length} occurrences</h3>
      {occurrences.map((o) => (
        <div key={o.id} className="card" style={{ padding: 12, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
            <strong>{fmt.dateTime(o.created_at)}</strong>
            {o.level !== "error" && <span className="badge">{o.level}</span>}
            {o.path && <span className="muted">{o.path}</span>}
            {o.user_id ? <Link to={`/users/${o.user_id}`}>{o.email ?? "Deleted user"}</Link> : <span className="muted">Signed out</span>}
            {Object.entries(o.meta ?? {}).map(([k, v]) => (
              <span key={k} className="muted">{k.replaceAll("_", " ")}: {typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
            ))}
          </div>
          {o.message !== group.message && <div style={{ fontSize: 13, overflowWrap: "anywhere" }}>{o.message}</div>}
          {o.stack ? (
            <pre style={{ margin: 0, overflowX: "auto", fontSize: 12, padding: 10, background: "var(--surface-2)", borderRadius: 8, maxHeight: 320 }}>{o.stack}</pre>
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>No stack trace was sent.</span>
          )}
        </div>
      ))}
    </div>
  );
}
