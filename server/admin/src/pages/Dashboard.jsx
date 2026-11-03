import { fmt } from "../api.js";
import { Breakdown, DailyBars, StatTile } from "../components/charts.jsx";
import { useApi } from "../useApi.js";

const THEME_LABEL = { male: "Black + Green", female: "Black + Maroon", neutral: "White + Black" };
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "0%");

export function Dashboard() {
  const { data, error, loading } = useApi("/admin/stats");
  if (error) return <div className="error">{error.message}</div>;
  if (loading && !data) return <p className="muted">Loading…</p>;
  const t = data.totals;
  const signups30 = data.signups.reduce((s, d) => s + d.count, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>How the app is doing right now.</p>
        </div>
        {!data.system.aiEnabled && (
          <div className="notice">AI is off. Plans use the built-in template until ANTHROPIC_API_KEY is set.</div>
        )}
      </div>

      <section className="grid tiles" aria-label="Key numbers">
        <StatTile label="Total users" value={fmt.num(t.users)} sub={`+${fmt.num(t.new_users_7d)} this week`} />
        <StatTile label="Active today" value={fmt.num(t.active_1d)} sub={`${fmt.num(t.active_30d)} in 30 days`} />
        <StatTile label="Premium" value={fmt.num(t.premium)} sub={`${pct(t.premium, t.users)} of users`} />
        <StatTile label="Finished onboarding" value={pct(t.onboarded, t.users)} sub={`${fmt.num(t.onboarded)} people`} />
        <StatTile label="Active goals" value={fmt.num(t.active_goals)} sub={`${fmt.num(t.completed_goals)} completed`} />
        <StatTile label="Tasks done (7 days)" value={fmt.num(t.tasks_done_7d)} />
        <StatTile label="Journal entries (7 days)" value={fmt.num(t.journal_entries_7d)} />
        <StatTile label="AI tokens (30 days)" value={fmt.compact(t.ai_tokens_30d)} sub={`${fmt.num(t.ai_calls_30d)} calls`} />
      </section>

      <section className="card">
        <h2>New sign-ups · last 30 days <span className="muted num" style={{ fontWeight: 600 }}>({fmt.num(signups30)})</span></h2>
        <DailyBars data={data.signups} valueKey="count" label="Sign-ups" />
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Theme chosen at onboarding</h2>
          <Breakdown rows={data.themes.map((r) => ({ label: THEME_LABEL[r.theme] ?? r.theme, count: r.count }))} emptyText="No one has finished onboarding yet." />
        </div>
        <div className="card">
          <h2>Goals by category</h2>
          <Breakdown rows={data.categories.map((r) => ({ label: cap(r.category), count: r.count }))} emptyText="No goals yet." />
        </div>
      </section>

      <p className="muted" style={{ fontSize: 12 }}>
        AI model: {data.system.aiModel} · Sign-ups {data.system.signupOpen ? "open" : "closed"}
        {suspendedNote(t.suspended)}
      </p>
    </>
  );
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const suspendedNote = (n) => (n ? ` · ${n} suspended account${n === 1 ? "" : "s"}` : "");
