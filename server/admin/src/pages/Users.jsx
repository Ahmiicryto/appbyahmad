import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fmt } from "../api.js";
import { useApi } from "../useApi.js";

const THEME_SWATCH = { male: "#22c55e", female: "#9b1c3a", neutral: "#ffffff" };

export function Users() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const page = Number(params.get("page") || 1);

  // Debounce the search box into the URL.
  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update({ q, page: 1 });
    }, 300);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(next) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) (v ? p.set(k, v) : p.delete(k));
    setParams(p, { replace: true });
  }

  const { data, error, loading } = useApi(`/admin/users?${params.toString()}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>{data ? `${fmt.num(data.total)} matching` : " "}</p>
        </div>
      </div>
      <div className="toolbar">
        <input type="search" aria-label="Search users" placeholder="Search by email or name" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Plan" value={params.get("plan") ?? ""} onChange={(e) => update({ plan: e.target.value, page: 1 })}>
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
        <select aria-label="Status" value={params.get("status") ?? ""} onChange={(e) => update({ status: e.target.value, page: 1 })}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select aria-label="Role" value={params.get("role") ?? ""} onChange={(e) => update({ role: e.target.value, page: 1 })}>
          <option value="">Any role</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {error && <div className="error">{error.message}</div>}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th><th>Plan</th><th>Status</th><th>Theme</th><th className="num">Active goals</th><th>Last seen</th><th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link to={`/users/${u.id}`}>{u.name || u.email}</Link>
                    {u.name && <div className="muted" style={{ fontSize: 12 }}>{u.email}</div>}
                    {u.role === "admin" && <span className="badge admin" style={{ marginLeft: 6 }}>Admin</span>}
                  </td>
                  <td><span className={`badge ${u.plan}`}>{u.plan === "premium" ? "Premium" : "Free"}</span></td>
                  <td><span className={`badge ${u.status}`}>{u.status === "active" ? "Active" : "Suspended"}</span></td>
                  <td>{u.onboarded ? <><span className="dot" style={{ background: THEME_SWATCH[u.theme] }} />{u.theme}</> : <span className="muted">Not onboarded</span>}</td>
                  <td className="num">{u.active_goals}</td>
                  <td>{fmt.ago(u.last_seen_at)}</td>
                  <td>{fmt.date(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.users.length && <p className="empty">No users match these filters.</p>}
          {loading && !data && <p className="empty">Loading…</p>}
        </div>
      </div>

      {pages > 1 && (
        <div className="toolbar">
          <button disabled={page <= 1} onClick={() => update({ page: page - 1 })}>Previous</button>
          <span className="muted">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => update({ page: page + 1 })}>Next</button>
        </div>
      )}
    </>
  );
}
