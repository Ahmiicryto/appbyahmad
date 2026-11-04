import { Link } from "react-router-dom";
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
          <div className="notice">AI is off. Plans use the built-in template. <Link to="/settings">Add an API key in Settings</Link>.</div>
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

      <Insights />

      <p className="muted" style={{ fontSize: 12 }}>
        AI model: {data.system.aiModel} · Sign-ups {data.system.signupOpen ? "open" : "closed"}
        {suspendedNote(t.suspended)}
      </p>
    </>
  );
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const suspendedNote = (n) => (n ? ` · ${n} suspended account${n === 1 ? "" : "s"}` : "");

const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: (cents ?? 0) % 100 ? 2 : 0 }).format((cents ?? 0) / 100);
const percent = (n) => `${Math.round((n ?? 0) * 10) / 10}%`;

// Growth, money and health over the last 30 days.
function Insights() {
  const { data, error, loading } = useApi("/admin/insights?days=30");
  if (error) return <div className="error">Couldn't load growth numbers. {error.message}</div>;
  if (loading && !data) return <p className="muted">Loading growth numbers…</p>;
  const dau = data.dau;
  const avgDau = dau.length ? Math.round(dau.reduce((s, d) => s + d.count, 0) / dau.length) : 0;
  const r = data.retention;

  return (
    <>
      <h2 style={{ margin: "12px 0 0", fontSize: 18 }}>Growth & health · last 30 days</h2>
      <section className="grid tiles" aria-label="Growth and health">
        <StatTile label="MRR" value={money(data.mrrCents)} sub={`${money(data.revenueCents)} collected in 30 days`} />
        <StatTile label="Premium conversion" value={percent(data.premiumConversion)} sub="of all users" />
        <StatTile label="Retention (days 7–30)" value={r.cohort ? percent(r.pct) : "—"} sub={r.cohort ? `${fmt.num(r.retained)} of ${fmt.num(r.cohort)} came back` : "Not enough sign-ups yet"} />
        <div className="card tile">
          <div className="label">Open errors (7 days)</div>
          <div className="value num">{fmt.num(data.openErrors)}</div>
          <div className="sub"><Link to="/errors">{data.openErrors ? "Review errors" : "View error log"}</Link></div>
        </div>
        <StatTile label="Notifications sent" value={fmt.num(data.notificationsSent30d)} sub="in-app, 30 days" />
        <StatTile label="Goals completed" value={fmt.num(data.goalsCompleted30d)} sub="30 days" />
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Daily active users <span className="muted num" style={{ fontWeight: 600 }}>(avg {fmt.num(avgDau)})</span></h2>
          <DailyBars data={dau} valueKey="count" label="Active users" />
          {data.dauSource === "last_seen" && (
            <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>Based on last sign-in until activity tracking has data.</p>
          )}
        </div>
        <div className="card">
          <h2>Revenue per day <span className="muted num" style={{ fontWeight: 600 }}>({money(data.revenueCents)})</span></h2>
          {/* Plotted in dollars so the axis reads $ amounts, not cents. */}
          <DailyBars data={data.revenue.map((d) => ({ day: d.day, dollars: d.cents / 100 }))} valueKey="dollars" label="Revenue" format={(v) => money(Math.round(v * 100))} />
        </div>
      </section>
    </>
  );
}
