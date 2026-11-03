import { Link } from "react-router-dom";
import { fmt } from "../api.js";
import { DailyBars, StatTile } from "../components/charts.jsx";
import { useApi } from "../useApi.js";

export function AiUsage() {
  const { data, error, loading } = useApi("/admin/ai-usage");
  if (error) return <div className="error">{error.message}</div>;
  if (loading && !data) return <p className="muted">Loading…</p>;
  const daily = data.daily.map((d) => ({ ...d, tokens: d.input_tokens + d.output_tokens }));
  const sum = (k) => daily.reduce((s, d) => s + d[k], 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>AI usage</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Last 30 days. Use this to watch cost and spot heavy users.</p>
        </div>
      </div>
      <section className="grid tiles">
        <StatTile label="Calls" value={fmt.num(sum("calls"))} />
        <StatTile label="Input tokens" value={fmt.compact(sum("input_tokens"))} />
        <StatTile label="Output tokens" value={fmt.compact(sum("output_tokens"))} />
      </section>
      <section className="card">
        <h2>Tokens per day</h2>
        <DailyBars data={daily} valueKey="tokens" label="Tokens" format={fmt.compact} />
      </section>
      <section className="grid two">
        <div className="card" style={{ padding: 0 }}>
          <h2 style={{ padding: "18px 18px 0" }}>By feature</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Feature</th><th>Model</th><th className="num">Calls</th><th className="num">Tokens</th></tr></thead>
              <tbody>
                {data.byKind.map((r) => (
                  <tr key={r.kind + r.model}>
                    <td>{r.kind.replace("_", " ")}</td><td>{r.model}</td>
                    <td className="num">{fmt.num(r.calls)}</td><td className="num">{fmt.compact(r.input_tokens + r.output_tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.byKind.length && <p className="empty">No AI calls yet.</p>}
          </div>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <h2 style={{ padding: "18px 18px 0" }}>Top users</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Plan</th><th className="num">Calls</th><th className="num">Tokens</th></tr></thead>
              <tbody>
                {data.topUsers.map((u) => (
                  <tr key={u.id}>
                    <td><Link to={`/users/${u.id}`}>{u.email}</Link></td><td>{u.plan}</td>
                    <td className="num">{fmt.num(u.calls)}</td><td className="num">{fmt.compact(u.tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.topUsers.length && <p className="empty">No AI calls yet.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
