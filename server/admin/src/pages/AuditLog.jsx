import { useState } from "react";
import { Link } from "react-router-dom";
import { fmt } from "../api.js";
import { useApi } from "../useApi.js";

export function AuditLog() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi(`/admin/audit?page=${page}`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Every admin change and account deletion, newest first.</p>
        </div>
      </div>
      {error && <div className="error">{error.message}</div>}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Change</th></tr></thead>
            <tbody>
              {data?.entries.map((e) => (
                <tr key={e.id}>
                  <td>{fmt.dateTime(e.created_at)}</td>
                  <td>{e.actor_email ?? <span className="muted">Deleted user</span>}</td>
                  <td>{e.action}</td>
                  <td>
                    {e.target_type === "user" && e.action !== "account.deleted" ? (
                      <Link to={`/users/${e.target_id}`}>{e.details?.email ?? e.target_id}</Link>
                    ) : (
                      e.details?.email ?? e.target_id
                    )}
                  </td>
                  <td className="muted">{e.details?.after ? JSON.stringify(e.details.after) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.entries.length && <p className="empty">Nothing logged yet.</p>}
          {loading && !data && <p className="empty">Loading…</p>}
        </div>
      </div>
      <div className="toolbar">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</button>
        <button disabled={!data || data.entries.length < 50} onClick={() => setPage(page + 1)}>Older</button>
      </div>
    </>
  );
}
