import { useState } from "react";
import { Link } from "react-router-dom";
import { api, fmt } from "../api.js";
import { DailyBars, StatTile } from "../components/charts.jsx";
import { useApi } from "../useApi.js";

const money = (cents, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "usd").toUpperCase(), maximumFractionDigits: cents % 100 ? 2 : 0 }).format(
    (cents ?? 0) / 100
  );

const textarea = {
  font: "inherit", color: "var(--text)", background: "var(--surface)", border: "1px solid var(--line)",
  borderRadius: 10, padding: "8px 12px", minHeight: 110, resize: "vertical"
};

export function Plans() {
  const status = useApi("/admin/billing/status");
  const overview = useApi("/admin/billing/overview");
  const plans = useApi("/admin/billing/plans");
  const [editing, setEditing] = useState(null); // plan id, "new" or null

  function saved() {
    setEditing(null);
    plans.reload();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Plans & payments</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Prices people see in the app, and what they've paid.</p>
        </div>
        <div className="toolbar">
          {status.data?.stripeConfigured && (
            <a className="btn" href={status.data.mode === "test" ? "https://dashboard.stripe.com/test" : "https://dashboard.stripe.com"} target="_blank" rel="noreferrer">
              Open Stripe dashboard
            </a>
          )}
          <button className="primary" onClick={() => setEditing("new")} disabled={editing === "new"}>New plan</button>
        </div>
      </div>

      <StatusBanner status={status} />

      {overview.error && <div className="error">{overview.error.message}</div>}
      {overview.data && <Overview data={overview.data} />}

      {editing === "new" && (
        <div className="card">
          <h2>New plan</h2>
          <PlanForm onCancel={() => setEditing(null)} onSaved={saved} stripeConfigured={status.data?.stripeConfigured} />
        </div>
      )}

      <section className="card" style={{ padding: 0 }}>
        <h2 style={{ padding: "18px 18px 0" }}>Plans</h2>
        {plans.error && <div className="error" style={{ margin: 18 }}>{plans.error.message}</div>}
        {plans.loading && !plans.data && <p className="muted" style={{ padding: 18 }}>Loading…</p>}
        {plans.data && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Plan</th><th className="num">Price</th><th>Trial</th><th className="num">Subscribers</th><th>Status</th><th>Stripe</th><th>App stores</th><th className="num">Sort</th><th /></tr>
              </thead>
              <tbody>
                {plans.data.plans.map((p) =>
                  editing === p.id ? (
                    <tr key={p.id}>
                      <td colSpan={9} style={{ whiteSpace: "normal", background: "var(--surface-2)" }}>
                        <PlanForm plan={p} onCancel={() => setEditing(null)} onSaved={saved} stripeConfigured={status.data?.stripeConfigured} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong><div className="muted">{p.id}</div></td>
                      <td className="num">{money(p.price_cents, p.currency)} / {p.interval}</td>
                      <td>{p.trial_days ? `${p.trial_days} days` : "None"}</td>
                      <td className="num">{fmt.num(p.subscribers)}</td>
                      <td>{p.active ? <span className="badge premium">Active</span> : <span className="badge">Archived</span>}</td>
                      <td>{p.stripe_price_id ? <code>{p.stripe_price_id}</code> : <span className="muted">Created at first checkout</span>}</td>
                      <td>{p.store_product_id ? <code>{p.store_product_id}</code> : <span className="muted">Not sold in apps</span>}</td>
                      <td className="num">{p.sort}</td>
                      <td><button onClick={() => setEditing(p.id)}>Edit</button></td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
            {!plans.data.plans.length && <p className="empty">No plans yet. Add one with New plan.</p>}
          </div>
        )}
      </section>

      {overview.data && <Payments payments={overview.data.payments} />}
      {overview.data && <Subscribers subscribers={overview.data.subscribers} />}
    </>
  );
}

function StatusBanner({ status }) {
  if (status.error) return <div className="error">{status.error.message}</div>;
  if (!status.data) return null;
  const s = status.data;
  if (!s.stripeConfigured) {
    return (
      <div className="notice" role="status">
        <strong>Payments are off.</strong> Add your Stripe keys in <Link to="/settings">Settings → Payments</Link> to start selling Premium.
      </div>
    );
  }
  return (
    <div className="card">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <strong>Stripe connected</strong>{" "}
          <span className={`badge${s.mode === "live" ? " premium" : ""}`}>{s.mode === "live" ? "Live mode" : "Test mode"}</span>
        </div>
        <Link to="/settings">Change keys in Settings</Link>
      </div>
      {s.mode === "test" && <p className="muted" style={{ margin: "8px 0 0" }}>Test mode: no real cards are charged. Switch to live keys when you're ready to sell.</p>}
      <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
        {!s.webhookConfigured && (
          <div className="error" role="alert">
            Stripe can't tell us about payments yet. Add the webhook signing secret in <Link to="/settings">Settings → Payments</Link>.
          </div>
        )}
        <div className="field">
          <span>Webhook URL — in Stripe go to Developers → Webhooks → Add endpoint and paste this:</span>
          <div className="toolbar">
            <input readOnly value={s.webhookUrl} style={{ flex: "1 1 320px" }} onFocus={(e) => e.target.select()} aria-label="Webhook URL" />
            <button onClick={() => navigator.clipboard?.writeText(s.webhookUrl)}>Copy URL</button>
          </div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Select these events: {s.webhookEvents.map((e, i) => <span key={e}>{i ? ", " : ""}<code>{e}</code></span>)}
        </p>
      </div>
    </div>
  );
}

function Overview({ data }) {
  const t = data.totals;
  const rows = data.revenue.map((d) => ({ day: d.day, dollars: d.cents / 100 }));
  return (
    <>
      <section className="grid tiles">
        <StatTile label="MRR" value={money(t.mrr_cents)} sub="Yearly plans ÷ 12, trials included" />
        <StatTile label="Paying subscribers" value={fmt.num(t.active)} sub={t.past_due ? `${fmt.num(t.past_due)} past due` : null} />
        <StatTile label="In free trial" value={fmt.num(t.trialing)} />
        <StatTile label="Revenue, 30 days" value={money(t.revenue_30d_cents)} sub={t.failed_30d ? `${fmt.num(t.failed_30d)} failed payments` : null} />
        <StatTile label="Cancelled, 30 days" value={fmt.num(t.canceled_30d)} />
      </section>
      <section className="card">
        <h2>Revenue per day</h2>
        <DailyBars data={rows} valueKey="dollars" label="Revenue" format={(v) => money(Math.round(v * 100))} />
      </section>
    </>
  );
}

function Payments({ payments }) {
  return (
    <section className="card" style={{ padding: 0 }}>
      <h2 style={{ padding: "18px 18px 0" }}>Recent payments</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>User</th><th className="num">Amount</th><th>Status</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{fmt.dateTime(p.created_at)}</td>
                <td>{p.user_id ? <Link to={`/users/${p.user_id}`}>{p.email}</Link> : <span className="muted">Deleted user</span>}</td>
                <td className="num">{money(p.amount_cents, p.currency)}</td>
                <td>{p.status === "succeeded" ? <span className="badge premium">Paid</span> : <span className="badge suspended">Failed</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!payments.length && <p className="empty">No payments yet. They appear here once Stripe sends them.</p>}
      </div>
    </section>
  );
}

const SUB_STATUS = { active: "Active", trialing: "Trial", past_due: "Past due" };

function Subscribers({ subscribers }) {
  return (
    <section className="card" style={{ padding: 0 }}>
      <h2 style={{ padding: "18px 18px 0" }}>Subscribers</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Plan</th><th>Status</th><th className="num">Price</th><th>Renews</th></tr></thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={s.id}>
                <td><Link to={`/users/${s.user_id}`}>{s.email}</Link></td>
                <td>{s.plan_name || s.plan_id || "—"}</td>
                <td><span className={`badge${s.status === "past_due" ? " suspended" : " premium"}`}>{SUB_STATUS[s.status] ?? s.status}</span></td>
                <td className="num">{s.amount_cents != null ? money(s.amount_cents, s.currency) : "—"}</td>
                <td>{s.cancel_at_period_end ? `Ends ${fmt.date(s.current_period_end)}` : fmt.date(s.current_period_end)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!subscribers.length && <p className="empty">No subscribers yet.</p>}
      </div>
    </section>
  );
}

function toForm(p) {
  return {
    id: p?.id ?? "",
    name: p?.name ?? "",
    description: p?.description ?? "",
    price: p ? (p.price_cents / 100).toFixed(2) : "",
    currency: p?.currency ?? "usd",
    interval: p?.interval ?? "month",
    trial_days: String(p?.trial_days ?? 0),
    features: (p?.features ?? []).join("\n"),
    store_product_id: p?.store_product_id ?? "",
    active: p?.active ?? true,
    sort: String(p?.sort ?? 0)
  };
}

function PlanForm({ plan, onCancel, onSaved, stripeConfigured }) {
  const isNew = !plan;
  const [f, setF] = useState(() => toForm(plan));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const priceCents = Math.round(Number(f.price) * 100);
  const priceValid = f.price.trim() !== "" && Number.isFinite(priceCents) && priceCents >= 0;
  const priceChanged =
    !isNew && (priceCents !== plan.price_cents || f.interval !== plan.interval || f.currency.trim().toLowerCase() !== plan.currency);

  async function save(e) {
    e.preventDefault();
    if (!priceValid) return setError("Enter a price like 12.99.");
    if (!isNew && plan.active && !f.active && !window.confirm(`Archive ${plan.name}? New users won't see it. Current subscribers keep their plan.`)) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const body = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      price_cents: priceCents,
      currency: f.currency.trim().toLowerCase(),
      interval: f.interval,
      trial_days: Number(f.trial_days) || 0,
      features: f.features.split("\n").map((s) => s.trim()).filter(Boolean),
      store_product_id: f.store_product_id.trim() || null,
      active: f.active,
      sort: Number(f.sort) || 0
    };
    try {
      const r = isNew
        ? await api("/admin/billing/plans", { method: "POST", body: { id: f.id.trim(), ...body } })
        : await api(`/admin/billing/plans/${plan.id}`, { method: "PATCH", body });
      if (r.stripeError) window.alert(r.stripeError);
      onSaved();
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fields ?? {});
      setBusy(false);
    }
  }

  const err = (k) => fieldErrors[k]?.[0] && <span style={{ color: "var(--danger)", fontWeight: 600 }}>{fieldErrors[k][0]}</span>;

  return (
    <form onSubmit={save} style={{ display: "grid", gap: 14, padding: isNew ? 0 : 6 }}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {isNew && (
          <label className="field">ID (can't change later)
            <input value={f.id} onChange={set("id")} placeholder="premium_family" required maxLength={40} />
            {err("id")}
          </label>
        )}
        <label className="field">Name<input value={f.name} onChange={set("name")} required maxLength={80} />{err("name")}</label>
        <label className="field">Price<input value={f.price} onChange={set("price")} inputMode="decimal" placeholder="12.99" required />{err("price_cents")}</label>
        <label className="field">Currency<input value={f.currency} onChange={set("currency")} maxLength={3} />{err("currency")}</label>
        <label className="field">Billed every
          <select value={f.interval} onChange={set("interval")}><option value="month">Month</option><option value="year">Year</option></select>
        </label>
        <label className="field">Free trial (days)<input type="number" min={0} max={90} value={f.trial_days} onChange={set("trial_days")} />{err("trial_days")}</label>
        <label className="field">Sort (lower shows first)<input type="number" value={f.sort} onChange={set("sort")} />{err("sort")}</label>
      </div>
      <label className="field">Description (shown under the name)<input value={f.description} onChange={set("description")} maxLength={300} placeholder="Billed every month" /></label>
      <label className="field">App Store / Google Play product ID
        <input value={f.store_product_id} onChange={set("store_product_id")} maxLength={100} placeholder="premium_monthly" />
        <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>The exact product ID you created in App Store Connect and Google Play Console (and added to RevenueCat). The stores charge their own price, so set the same price there.</span>
        {err("store_product_id")}
      </label>
      <label className="field">Features, one per line<textarea style={textarea} value={f.features} onChange={set("features")} />{err("features")}</label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
        <input type="checkbox" checked={f.active} onChange={set("active")} style={{ minHeight: 0 }} /> Show this plan in the app
      </label>
      {priceChanged && (
        <div className="notice">
          {stripeConfigured
            ? "Saving creates a new price in Stripe. Existing subscribers keep their old price; new checkouts use the new one."
            : "Existing subscribers keep their old price; new checkouts use the new one."}
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
      <div className="toolbar">
        <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : isNew ? "Create plan" : "Save plan"}</button>
        <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
