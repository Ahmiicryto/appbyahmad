import { useState } from "react";
import { api, setToken } from "../api.js";

export function Login({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api("/auth/login", { method: "POST", body: { email, password } });
      if (r.user.role !== "admin") throw new Error("This account doesn't have admin access.");
      setToken(r.token);
      onSignedIn(r.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card" onSubmit={submit} style={{ width: "min(380px, calc(100vw - 32px))", display: "grid", gap: 14 }}>
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>AppByAhmad Admin</span>
        </div>
        <h1>Sign in</h1>
        {error && <div className="error" role="alert">{error}</div>}
        <label className="field">Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
