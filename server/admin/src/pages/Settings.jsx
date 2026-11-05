import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, fmt, getToken, setToken } from "../api.js";
import { useApi } from "../useApi.js";

const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
const FEATURES = [
  ["journal", "Journal"],
  ["money", "Money"],
  ["fitness", "Fitness"],
  ["nutrition", "Nutrition"],
  ["career", "Career"],
  ["future_me", "Future Me"],
  ["decisions", "Decisions"],
  ["assistant", "Assistant chat"]
];
const LEVELS = { info: "Info", success: "Good news", warning: "Warning" };
const LEVEL_STYLE = {
  info: { background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--line)" },
  success: { background: "var(--accent-soft)", color: "var(--accent-ink)", borderColor: "transparent" },
  warning: { background: "rgba(245, 184, 65, 0.14)", color: "var(--warn)", borderColor: "transparent" }
};

// PATCH that keeps the per-field errors the shared api() helper drops.
async function patchSettings(body) {
  const res = await fetch("/api/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event("aba:signed-out"));
  }
  if (!res.ok) {
    const err = new ApiError(res.status, data);
    err.fields = data?.error?.fields ?? {};
    throw err;
  }
  return data;
}

export function Settings() {
  const { data, error, loading } = useApi("/admin/settings");
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    if (data) setSettings(data.settings);
  }, [data]);

  if (error) return <div className="error">{error.message}</div>;
  if ((loading && !data) || !settings) return <p className="muted">Loading…</p>;
  const onSaved = (next) => setSettings(next.settings);
  const props = { settings, onSaved };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Changes apply to the app within 15 seconds. No redeploy needed.</p>
        </div>
      </div>
      <AiCard {...props} />
      <LimitsCard {...props} />
      <AppCard {...props} />
      <StoreCard {...props} />
      <PaymentsCard {...props} />
      <PushCard {...props} />
    </>
  );
}

// ---------- shared card state ----------

function initialDraft(keys, settings) {
  const d = {};
  for (const k of keys) {
    const s = settings[k];
    d[k] = s.secret ? { value: "", remove: false } : typeof s.value === "number" ? String(s.value) : s.value;
  }
  return d;
}

function useCard(keys, settings, onSaved, confirmFn) {
  const [draft, setDraft] = useState(() => initialDraft(keys, settings));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null); // null | "saving" | "saved" | {error}
  const base = useMemo(() => initialDraft(keys, settings), [keys, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const changes = {};
  for (const k of keys) {
    const s = settings[k];
    if (s.secret) {
      if (draft[k].value.trim()) changes[k] = draft[k].value.trim();
      else if (draft[k].remove) changes[k] = null;
    } else if (JSON.stringify(draft[k]) !== JSON.stringify(base[k])) {
      const v = draft[k];
      if (typeof s.value === "number") changes[k] = v.trim() === "" || Number.isNaN(Number(v)) ? v : Number(v);
      else if (typeof v === "string" && v.trim() === "") {
        // An emptied text field goes back to its default.
        if (base[k]) changes[k] = null;
      } else changes[k] = v;
    }
  }
  const dirty = Object.keys(changes).length > 0;

  const set = (k, v) => {
    setDraft((d) => ({ ...d, [k]: typeof v === "function" ? v(d[k]) : v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
    if (status === "saved") setStatus(null);
  };

  async function save(e) {
    e?.preventDefault();
    if (!dirty) return;
    if (confirmFn && !confirmFn(changes)) return;
    setStatus("saving");
    setErrors({});
    try {
      const next = await patchSettings(changes);
      onSaved(next);
      setDraft(initialDraft(keys, next.settings));
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? null : s)), 3000);
    } catch (err) {
      setErrors(err.fields ?? {});
      setStatus({ error: err.fields && Object.keys(err.fields).length ? "Fix the highlighted fields, then save again." : err.message });
    }
  }

  return { draft, set, errors, status, dirty, save, reset: () => setDraft(base) };
}

function Card({ title, desc, card, children, extra }) {
  const { status, dirty, save, reset } = card;
  return (
    <form className="card" onSubmit={save} noValidate>
      <h2 style={{ marginBottom: desc ? 4 : 12 }}>{title}</h2>
      {desc && <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>{desc}</p>}
      <div style={{ display: "grid", gap: 16 }}>{children}</div>
      <div className="toolbar" style={{ marginTop: 18 }}>
        <button type="submit" className="primary" disabled={!dirty || status === "saving"}>
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {dirty && status !== "saving" && <button type="button" className="link" onClick={reset}>Discard</button>}
        {status === "saved" && <span role="status" style={{ color: "var(--accent-ink)", fontWeight: 700 }}>Saved</span>}
        {extra}
      </div>
      {status?.error && <div className="error" role="alert" style={{ marginTop: 12 }}>{status.error}</div>}
    </form>
  );
}

function FieldError({ messages }) {
  if (!messages?.length) return null;
  return <span role="alert" style={{ color: "var(--danger)", fontWeight: 600, fontSize: 12 }}>{messages.join(" ")}</span>;
}

function Hint({ children }) {
  return <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{children}</span>;
}

function Source({ s }) {
  if (!s.updated_at || s.source !== "admin") return null;
  return <Hint>Changed {fmt.ago(s.updated_at)}</Hint>;
}

function TextField({ k, card, settings, label, hint, type = "text", list, placeholder, inputMode }) {
  const s = settings[k];
  return (
    <label className="field">
      {label ?? s.label}
      <input
        type={type}
        value={card.draft[k] ?? ""}
        list={list}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={Boolean(card.errors[k])}
        onChange={(e) => card.set(k, e.target.value)}
      />
      {hint && <Hint>{hint}</Hint>}
      <FieldError messages={card.errors[k]} />
      <Source s={s} />
    </label>
  );
}

function Toggle({ checked, onChange, label, hint, error }) {
  return (
    <div>
      <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, minHeight: 0 }} />
        {label}
      </label>
      {hint && <div style={{ marginLeft: 28 }}><Hint>{hint}</Hint></div>}
      {error && <div style={{ marginLeft: 28 }}><FieldError messages={error} /></div>}
    </div>
  );
}

function BoolField({ k, card, settings, label, hint }) {
  return <Toggle checked={card.draft[k]} onChange={(v) => card.set(k, v)} label={label ?? settings[k].label} hint={hint} error={card.errors[k]} />;
}

// Secrets are write-only: never prefilled, only the last 4 characters are shown.
function SecretField({ k, card, settings, label, hint, placeholder }) {
  const s = settings[k];
  const d = card.draft[k];
  const from = s.source === "admin" ? "saved here" : "from environment";
  return (
    <div className="field">
      <span>{label ?? s.label}</span>
      <span style={{ fontWeight: 400 }}>
        {s.configured ? (
          <>Configured <span className="num">{s.hint}</span> <span className="muted">({from})</span></>
        ) : (
          s.unreadable ? (
            <span style={{ color: "var(--danger)" }}>Saved, but can't be read (the encryption key changed). Paste it again.</span>
          ) : (
            <span className="muted">Not set</span>
          )
        )}
      </span>
      {d.remove ? (
        <div className="toolbar">
          <span className="muted" style={{ fontWeight: 400 }}>
            Will be removed when you save{s.source === "admin" && s.configured ? ". The environment value is used if there is one." : "."}
          </span>
          <button type="button" className="link" onClick={() => card.set(k, { value: "", remove: false })}>Undo</button>
        </div>
      ) : (
        <div className="toolbar">
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            aria-label={`${s.configured ? "Replace" : "Add"} ${label ?? s.label}`}
            placeholder={placeholder ?? (s.configured ? "Replace key" : "Paste key")}
            value={d.value}
            aria-invalid={Boolean(card.errors[k])}
            onChange={(e) => card.set(k, { value: e.target.value, remove: false })}
            style={{ flex: "1 1 260px" }}
          />
          {s.source === "admin" && (
            <button type="button" className="danger" onClick={() => card.set(k, { value: "", remove: true })}>Remove</button>
          )}
        </div>
      )}
      {hint && <Hint>{hint}</Hint>}
      <FieldError messages={card.errors[k]} />
      <Source s={s} />
    </div>
  );
}

function TestButton({ path, label, render, disabled }) {
  const [state, setState] = useState(null);
  async function run() {
    setState("running");
    try {
      setState(await api(path, { method: "POST" }));
    } catch (err) {
      setState({ ok: false, message: err.message });
    }
  }
  return (
    <>
      <button type="button" onClick={run} disabled={disabled || state === "running"}>
        {state === "running" ? "Testing…" : label}
      </button>
      {state && state !== "running" && (
        <span role="status" style={{ fontWeight: 600, color: state.ok ? "var(--accent-ink)" : "var(--danger)" }}>
          {state.ok ? render(state) : state.message}
        </span>
      )}
    </>
  );
}

// ---------- cards ----------

const AI_KEYS = ["anthropic_api_key", "ai_model", "ai_enabled"];
function AiCard({ settings, onSaved }) {
  const card = useCard(AI_KEYS, settings, onSaved);
  return (
    <Card
      title="AI"
      desc="Used for goal plans and the assistant. Save a key first, then test it."
      card={card}
      extra={
        <TestButton
          path="/admin/settings/test-ai"
          label="Test AI connection"
          disabled={card.dirty}
          render={(r) => `Connected. ${r.model} replied.`}
        />
      }
    >
      <SecretField k="anthropic_api_key" card={card} settings={settings} label="API key" hint="From console.anthropic.com → API keys. Starts with sk-ant-." />
      <TextField k="ai_model" card={card} settings={settings} label="Model" list="ai-models" hint="Pick a suggestion or type any Claude model ID." />
      <datalist id="ai-models">{MODELS.map((m) => <option key={m} value={m} />)}</datalist>
      <BoolField k="ai_enabled" card={card} settings={settings} label="AI features on" hint="When off, plans use the built-in template and no AI calls are made." />
    </Card>
  );
}

const LIMIT_KEYS = ["free_active_goals", "free_ai_plans_per_month"];
function LimitsCard({ settings, onSaved }) {
  const card = useCard(LIMIT_KEYS, settings, onSaved);
  return (
    <Card title="Plans & limits" desc="What the free plan includes. Premium has no limits." card={card}>
      <div className="grid two">
        <TextField k="free_active_goals" card={card} settings={settings} type="number" inputMode="numeric" label="Active goals on the free plan" hint="0–100" />
        <TextField k="free_ai_plans_per_month" card={card} settings={settings} type="number" inputMode="numeric" label="AI plans per month on the free plan" hint="0–1000. After this, plans use the template." />
      </div>
    </Card>
  );
}

const APP_KEYS = ["signup_open", "maintenance_mode", "maintenance_message", "announcement", "feature_flags", "min_app_version", "terms_url", "privacy_url", "support_email"];
function confirmApp(changes) {
  if (changes.maintenance_mode === true && !window.confirm("Turn on maintenance mode? People can't use the app until you turn it off.")) return false;
  if (changes.signup_open === false && !window.confirm("Close sign-ups? New people can't create accounts until you open them again.")) return false;
  return true;
}
function AppCard({ settings, onSaved }) {
  const card = useCard(APP_KEYS, settings, onSaved, confirmApp);
  const a = card.draft.announcement;
  const flags = card.draft.feature_flags;
  const setA = (patch) => card.set("announcement", (cur) => ({ ...cur, ...patch }));

  return (
    <Card title="App" desc="What people see in the phone app." card={card}>
      <BoolField k="signup_open" card={card} settings={settings} label="New sign-ups allowed" hint="When off, existing people can still sign in." />

      <div style={{ display: "grid", gap: 10 }}>
        <BoolField
          k="maintenance_mode"
          card={card}
          settings={settings}
          label="Maintenance mode"
          hint="Blocks the app for everyone except admins. Sign-in and admin pages keep working."
        />
        {card.draft.maintenance_mode && settings.maintenance_mode.value && (
          <div className="error" role="status">Maintenance mode is on. People can't use the app right now.</div>
        )}
        <TextField k="maintenance_message" card={card} settings={settings} label="Maintenance message" hint="Shown in the app while maintenance mode is on. Up to 300 characters." />
      </div>

      <fieldset style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, margin: 0, display: "grid", gap: 12 }}>
        <legend style={{ fontWeight: 700, fontSize: 13, padding: "0 6px" }}>Announcement banner</legend>
        <label className="field">
          Text
          <input type="text" maxLength={200} value={a.text} placeholder="New: weekly reviews are here" onChange={(e) => setA({ text: e.target.value })} />
          <Hint>{a.text.length}/200</Hint>
        </label>
        <div className="toolbar">
          <label className="field" style={{ flex: "0 1 200px" }}>
            Style
            <select value={a.level} onChange={(e) => setA({ level: e.target.value })}>
              {Object.entries(LEVELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <div style={{ alignSelf: "flex-end", paddingBottom: 8 }}>
            <Toggle checked={a.active} onChange={(v) => setA({ active: v })} label="Show in the app" />
          </div>
        </div>
        <div>
          <Hint>Preview</Hint>
          <div
            aria-label="Announcement preview"
            style={{
              ...LEVEL_STYLE[a.level],
              border: "1px solid",
              borderRadius: 12,
              padding: "10px 14px",
              marginTop: 6,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontWeight: 600,
              opacity: a.active ? 1 : 0.5
            }}
          >
            <span>{a.text || "Your announcement text appears here."}</span>
            <span aria-hidden="true">×</span>
          </div>
          {!a.active && <Hint>Hidden. Turn on "Show in the app" to publish it.</Hint>}
        </div>
        <FieldError messages={card.errors.announcement} />
      </fieldset>

      <fieldset style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, margin: 0, display: "grid", gap: 10 }}>
        <legend style={{ fontWeight: 700, fontSize: 13, padding: "0 6px" }}>Features visible in the app</legend>
        <Hint>Turn on only when the feature is ready. Hidden features show as "Coming next".</Hint>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {FEATURES.map(([key, name]) => (
            <Toggle key={key} checked={flags[key]} label={name} onChange={(v) => card.set("feature_flags", (cur) => ({ ...cur, [key]: v }))} />
          ))}
        </div>
        <FieldError messages={card.errors.feature_flags} />
      </fieldset>

      <TextField
        k="min_app_version"
        card={card}
        settings={settings}
        label="Minimum app version"
        placeholder="1.0.0"
        hint="Older app versions are asked to update before they can continue. Use the format 1.2.3."
      />
      <div className="grid two">
        <TextField k="terms_url" card={card} settings={settings} type="url" label="Terms of use link" placeholder="https://…" hint="Shown on sign-up and the plans screen. Apple requires it for subscriptions." />
        <TextField k="privacy_url" card={card} settings={settings} type="url" label="Privacy policy link" placeholder="https://…" hint="Required by Apple and Google." />
      </div>
      <TextField k="support_email" card={card} settings={settings} type="email" label="Support email" placeholder="help@yourdomain.com" hint="Where Help &amp; support in the app sends people." />
    </Card>
  );
}

const PAY_KEYS = ["stripe_secret_key", "stripe_webhook_secret", "stripe_publishable_key", "checkout_success_url", "checkout_cancel_url"];
function PaymentsCard({ settings, onSaved }) {
  const card = useCard(PAY_KEYS, settings, onSaved);
  return (
    <Card
      title="Payments"
      desc={<>Stripe keys from dashboard.stripe.com → Developers. Set prices on the <Link to="/plans">Plans</Link> page.</>}
      card={card}
      extra={
        <TestButton
          path="/admin/settings/test-stripe"
          label="Test Stripe connection"
          disabled={card.dirty}
          render={(r) => `Connected in ${r.mode} mode.`}
        />
      }
    >
      <SecretField k="stripe_secret_key" card={card} settings={settings} label="Secret key" hint="Starts with sk_test_ or sk_live_ (or rk_ for restricted keys)." />
      <SecretField k="stripe_webhook_secret" card={card} settings={settings} label="Webhook signing secret" hint="Starts with whsec_. Webhook URL: /api/billing/webhook on this server." placeholder={settings.stripe_webhook_secret.configured ? "Replace secret" : "Paste secret"} />
      <TextField k="stripe_publishable_key" card={card} settings={settings} label="Publishable key" placeholder="pk_test_…" hint="Starts with pk_test_ or pk_live_. Safe to share." />
      <div className="grid two">
        <TextField k="checkout_success_url" card={card} settings={settings} type="url" label="After-payment page" placeholder="https://…" />
        <TextField k="checkout_cancel_url" card={card} settings={settings} type="url" label="Cancelled-payment page" placeholder="https://…" />
      </div>
    </Card>
  );
}

const STORE_KEYS = ["revenuecat_ios_key", "revenuecat_android_key", "revenuecat_secret_key", "revenuecat_webhook_auth", "revenuecat_entitlement"];
function StoreCard({ settings, onSaved }) {
  const card = useCard(STORE_KEYS, settings, onSaved);
  const webhookUrl = `${window.location.origin}/api/billing/revenuecat/webhook`;
  const ready = settings.revenuecat_ios_key.value || settings.revenuecat_android_key.value;
  return (
    <Card
      title="In-app purchases (App Store & Google Play)"
      desc={<>Subscriptions bought inside the phone app go through RevenueCat. Keys are in app.revenuecat.com → Project settings → API keys. Put each plan's store product ID on the <Link to="/plans">Plans</Link> page.</>}
      card={card}
      extra={<span className="muted" style={{ fontSize: 13 }}>{ready ? "Store purchases are on in the app." : "Store purchases are off until a public key is saved."}</span>}
    >
      <div className="grid two">
        <TextField k="revenuecat_ios_key" card={card} settings={settings} label="Apple public SDK key" placeholder="appl_…" hint="Starts with appl_. Safe to share." />
        <TextField k="revenuecat_android_key" card={card} settings={settings} label="Google public SDK key" placeholder="goog_…" hint="Starts with goog_. Safe to share." />
      </div>
      <SecretField k="revenuecat_secret_key" card={card} settings={settings} label="Secret API key" hint="Starts with sk_. Lets the server confirm purchases instantly and keep plans in sync." placeholder={settings.revenuecat_secret_key.configured ? "Replace key" : "Paste key"} />
      <SecretField
        k="revenuecat_webhook_auth"
        card={card}
        settings={settings}
        label="Webhook password"
        hint={<>Make up a long password (16+ characters). In RevenueCat → Integrations → Webhooks, set the URL to <code style={{ userSelect: "all" }}>{webhookUrl}</code> and the Authorization header value to this same password.</>}
        placeholder={settings.revenuecat_webhook_auth.configured ? "Replace password" : "Make up a password"}
      />
      <TextField k="revenuecat_entitlement" card={card} settings={settings} label="Entitlement ID" placeholder="premium" hint="The entitlement in RevenueCat that unlocks Premium. Usually premium." />
    </Card>
  );
}

const PUSH_KEYS = ["expo_access_token"];
function PushCard({ settings, onSaved }) {
  const card = useCard(PUSH_KEYS, settings, onSaved);
  return (
    <Card title="Push notifications" desc="Optional. Only needed if Enhanced Push Security is on in your Expo account." card={card}>
      <SecretField k="expo_access_token" card={card} settings={settings} label="Expo access token" placeholder={settings.expo_access_token.configured ? "Replace token" : "Paste token"} />
    </Card>
  );
}
