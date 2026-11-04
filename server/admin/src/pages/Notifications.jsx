import { useEffect, useState } from "react";
import { api, fmt } from "../api.js";
import { StatTile } from "../components/charts.jsx";
import { useApi } from "../useApi.js";

const TITLE_MAX = 65;
const BODY_MAX = 240;

const ROUTES = [
  { value: "", label: "Nothing (just open the app)" },
  { value: "/", label: "Today" },
  { value: "/goals", label: "Goals" },
  { value: "/journal", label: "Journal" },
  { value: "/progress", label: "Progress" },
  { value: "/premium", label: "Premium" },
  { value: "custom", label: "Custom route or link…" }
];

const AUDIENCES = [
  { type: "all", label: "Everyone" },
  { type: "free", label: "Free plan" },
  { type: "premium", label: "Premium" },
  { type: "inactive", label: "Inactive for N days" },
  { type: "theme", label: "Theme" },
  { type: "user", label: "One person by email" }
];

const textareaStyle = {
  font: "inherit", color: "var(--text)", background: "var(--surface)", border: "1px solid var(--line)",
  borderRadius: 10, padding: "8px 12px", minHeight: 96, resize: "vertical"
};

function toAudience(a) {
  switch (a.type) {
    case "free": return { type: "plan", plan: "free" };
    case "premium": return { type: "plan", plan: "premium" };
    case "inactive": return { type: "inactive", days: Number(a.days) };
    case "theme": return { type: "theme", theme: a.theme };
    case "user": return { type: "user", email: a.email.trim() };
    default: return { type: "all" };
  }
}

function audienceReady(a) {
  if (a.type === "inactive") return Number.isInteger(Number(a.days)) && a.days >= 1 && a.days <= 365;
  if (a.type === "user") return /^\S+@\S+\.\S+$/.test(a.email.trim());
  return true;
}

function describeAudience(a) {
  if (!a) return "—";
  switch (a.type) {
    case "all": return "Everyone";
    case "plan": return a.plan === "premium" ? "Premium" : "Free plan";
    case "inactive": return `Inactive ${a.days}+ days`;
    case "theme": return `Theme: ${a.theme}`;
    case "user": return a.email;
    default: return a.type;
  }
}

const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export function Notifications() {
  const stats = useApi("/admin/notifications/stats");
  const campaigns = useApi("/admin/notifications/campaigns");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [route, setRoute] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [aud, setAud] = useState({ type: "all", days: 14, theme: "neutral", email: "" });
  const [sendPush, setSendPush] = useState(true);
  const [count, setCount] = useState({ data: null, error: null, loading: false });
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [notice, setNotice] = useState(null);

  const ready = audienceReady(aud);
  const audienceKey = JSON.stringify(ready ? toAudience(aud) : null);

  // Live recipient count, debounced.
  useEffect(() => {
    if (!ready) {
      setCount({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setCount((c) => ({ ...c, loading: true }));
    const id = setTimeout(() => {
      api("/admin/notifications/preview", { method: "POST", body: { audience: JSON.parse(audienceKey) } })
        .then((data) => !cancelled && setCount({ data, error: null, loading: false }))
        .catch((error) => !cancelled && setCount({ data: null, error, loading: false }));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [audienceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const url = route === "custom" ? customUrl.trim() : route;
  const urlOk = !url || /^\/\S*$/.test(url) || /^https:\/\/\S+$/i.test(url);
  const recipients = count.data?.recipients ?? 0;
  const canSend = title.trim() && body.trim() && title.length <= TITLE_MAX && body.length <= BODY_MAX && urlOk && ready && recipients > 0 && !busy;

  async function send(e) {
    e.preventDefault();
    if (!canSend) return;
    const people = `${fmt.num(recipients)} ${recipients === 1 ? "person" : "people"}`;
    const pushLine = sendPush ? ` ${fmt.num(count.data.withPush)} will also get a push notification.` : "";
    if (!window.confirm(`Send to ${people}?${pushLine} This can't be undone.`)) return;
    setBusy(true);
    setSendError(null);
    setNotice(null);
    try {
      const r = await api("/admin/notifications/send", {
        method: "POST",
        body: { title: title.trim(), body: body.trim(), url: url || null, audience: toAudience(aud), send_push: sendPush }
      });
      const c = r.campaign;
      setNotice(
        `Sent to ${fmt.num(c.recipients)} ${c.recipients === 1 ? "person" : "people"}.` +
          (c.send_push ? ` Push: ${fmt.num(c.push_sent)} delivered, ${fmt.num(c.push_failed)} failed.` : "")
      );
      setTitle("");
      setBody("");
      setRoute("");
      setCustomUrl("");
      stats.reload();
      campaigns.reload();
    } catch (err) {
      setSendError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const s = stats.data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Send messages to people's in-app inbox and, if they allow it, their phone.</p>
        </div>
      </div>

      {stats.error && <div className="error">{stats.error.message}</div>}
      <section className="grid tiles">
        <StatTile label="Devices with push" value={s ? fmt.num(s.push_tokens) : "—"} />
        <StatTile label="People with push" value={s ? fmt.num(s.users_with_push) : "—"} />
        <StatTile label="Campaigns, last 30 days" value={s ? fmt.num(s.campaigns_30d) : "—"} />
        <StatTile label="Read rate, last 30 days" value={s ? pct(s.read_rate_30d) : "—"} sub={s ? `${fmt.num(s.read_30d)} of ${fmt.num(s.sent_30d)} read` : null} />
      </section>

      <section className="grid two">
        <form className="card" onSubmit={send} style={{ display: "grid", gap: 14 }}>
          <h2 style={{ margin: 0 }}>New notification</h2>

          <label className="field">
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              Title <Counter n={title.length} max={TITLE_MAX} />
            </span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New: weekly review" maxLength={TITLE_MAX + 20} />
          </label>

          <label className="field">
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              Message <Counter n={body.length} max={BODY_MAX} />
            </span>
            <textarea style={textareaStyle} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Look back on your week in two minutes." maxLength={BODY_MAX + 40} />
          </label>

          <label className="field">
            Open in app (optional)
            <select value={route} onChange={(e) => setRoute(e.target.value)}>
              {ROUTES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}{r.value && r.value !== "custom" ? ` (${r.value})` : ""}</option>
              ))}
            </select>
          </label>
          {route === "custom" && (
            <label className="field">
              Route or link
              <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="/goals or https://example.com" />
              {!urlOk && <span style={{ color: "var(--danger)", fontWeight: 600 }}>Use an in-app route that starts with "/" or a link that starts with https://</span>}
            </label>
          )}

          <fieldset style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, margin: 0, display: "grid", gap: 8 }}>
            <legend style={{ fontWeight: 600, fontSize: 13, padding: "0 4px" }}>Who gets it</legend>
            {AUDIENCES.map((o) => (
              <label key={o.type} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input type="radio" name="audience" checked={aud.type === o.type} onChange={() => setAud({ ...aud, type: o.type })} style={{ minHeight: 0 }} />
                {o.label}
                {o.type === "inactive" && aud.type === "inactive" && (
                  <input type="number" min={1} max={365} value={aud.days} aria-label="Days inactive" style={{ width: 90 }}
                    onChange={(e) => setAud({ ...aud, days: e.target.value === "" ? "" : Number(e.target.value) })} />
                )}
                {o.type === "theme" && aud.type === "theme" && (
                  <select value={aud.theme} aria-label="Theme" onChange={(e) => setAud({ ...aud, theme: e.target.value })}>
                    <option value="neutral">Neutral</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                )}
                {o.type === "user" && aud.type === "user" && (
                  <input type="email" value={aud.email} aria-label="Email" placeholder="name@example.com" style={{ flex: "1 1 200px" }}
                    onChange={(e) => setAud({ ...aud, email: e.target.value })} />
                )}
              </label>
            ))}
            <p className="muted" style={{ margin: 0 }} aria-live="polite">
              {!ready
                ? aud.type === "user" ? "Enter an email address." : "Enter a number of days from 1 to 365."
                : count.error ? count.error.message
                : count.data ? `${fmt.num(count.data.recipients)} ${count.data.recipients === 1 ? "person" : "people"} · ${fmt.num(count.data.withPush)} with push on${count.loading ? " · updating…" : ""}`
                : "Counting…"}
            </p>
            {ready && count.data && count.data.recipients === 0 && (
              <p style={{ margin: 0, color: "var(--warn)", fontWeight: 600 }}>No one matches. Pick a different audience.</p>
            )}
          </fieldset>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={sendPush} onChange={(e) => setSendPush(e.target.checked)} style={{ minHeight: 0 }} />
            Also send as push notification
          </label>

          {sendError && <div className="error" role="alert">{sendError}</div>}
          {notice && <div className="notice" role="status">{notice}</div>}

          <div className="toolbar">
            <button className="primary" type="submit" disabled={!canSend}>
              {busy ? "Sending…" : "Send notification"}
            </button>
          </div>
        </form>

        <div className="card">
          <h2>Preview</h2>
          <PhonePreview title={title} body={body} push={sendPush} />
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
            {url ? `Tapping opens ${url}.` : "Tapping opens the app."} Exact look depends on the phone.
          </p>
        </div>
      </section>

      <section className="card" style={{ padding: 0 }}>
        <h2 style={{ padding: "18px 18px 0" }}>History</h2>
        {campaigns.error && <div className="error" style={{ margin: 18 }}>{campaigns.error.message}</div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sent</th><th>Notification</th><th>Audience</th><th className="num">Recipients</th><th className="num">Read</th>
                <th className="num">Push sent</th><th className="num">Push failed</th><th>Status</th><th>By</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.data?.campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{fmt.dateTime(c.created_at)}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 220 }}>
                    <strong>{c.title}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{c.body}</div>
                    {c.data?.url && <div className="muted" style={{ fontSize: 12 }}>Opens {c.data.url}</div>}
                  </td>
                  <td>{describeAudience(c.audience)}</td>
                  <td className="num">{fmt.num(c.recipients)}</td>
                  <td className="num">{c.recipients ? pct(c.read_count / c.recipients) : "—"}</td>
                  <td className="num">{c.send_push ? fmt.num(c.push_sent) : "—"}</td>
                  <td className="num">{c.send_push ? fmt.num(c.push_failed) : "—"}</td>
                  <td><span className={`badge${c.status === "failed" ? " suspended" : ""}`}>{c.status === "sent" ? "Sent" : c.status === "failed" ? "Failed" : "Sending"}</span></td>
                  <td>{c.created_by_email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {campaigns.data && !campaigns.data.campaigns.length && <p className="empty">No notifications sent yet.</p>}
          {campaigns.loading && !campaigns.data && <p className="empty">Loading…</p>}
        </div>
      </section>
    </>
  );
}

function Counter({ n, max }) {
  const over = n > max;
  return (
    <span className="num" style={{ color: over ? "var(--danger)" : "var(--muted)", fontWeight: 600 }} aria-live="polite">
      {n}/{max}{over ? " · too long" : ""}
    </span>
  );
}

function PhonePreview({ title, body, push }) {
  return (
    <div style={{
      maxWidth: 340, margin: "0 auto", borderRadius: 32, border: "1px solid var(--line)", padding: "18px 12px 28px",
      background: "linear-gradient(160deg, var(--surface-2), var(--bg))"
    }}>
      <div className="muted num" style={{ textAlign: "center", fontSize: 12, fontWeight: 700, marginBottom: 14 }}>9:41</div>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: "10px 12px",
        boxShadow: "0 6px 20px rgba(0,0,0,.2)", opacity: push ? 1 : 0.6
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: "var(--accent)", display: "inline-block" }} />
          <span style={{ flex: 1 }}>{push ? "PUSH NOTIFICATION" : "IN-APP INBOX ONLY"}</span>
          <span>now</span>
        </div>
        <div style={{ fontWeight: 800, marginTop: 6, overflowWrap: "anywhere" }}>{title.trim() || "Your title"}</div>
        <div style={{ fontSize: 13, marginTop: 2, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {body.trim() || "Your message shows here."}
        </div>
      </div>
    </div>
  );
}
