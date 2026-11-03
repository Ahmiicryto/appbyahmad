import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { api, getToken, setToken } from "./api.js";
import { Layout } from "./components/Layout.jsx";
import { AiUsage } from "./pages/AiUsage.jsx";
import { AuditLog } from "./pages/AuditLog.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Login } from "./pages/Login.jsx";
import { UserDetail } from "./pages/UserDetail.jsx";
import { Users } from "./pages/Users.jsx";
import "./styles.css";

function App() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));

  useEffect(() => {
    const out = () => setMe(null);
    window.addEventListener("aba:signed-out", out);
    if (getToken()) {
      api("/auth/me")
        .then((r) => (r.user.role === "admin" ? setMe(r.user) : setToken(null)))
        .catch(() => setToken(null))
        .finally(() => setChecking(false));
    }
    return () => window.removeEventListener("aba:signed-out", out);
  }, []);

  if (checking) return <div className="center muted">Loading…</div>;
  if (!me) return <Login onSignedIn={setMe} />;

  const signOut = () => {
    setToken(null);
    setMe(null);
  };

  return (
    <BrowserRouter basename="/admin">
      <Layout me={me} onSignOut={signOut}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:id" element={<UserDetail me={me} />} />
          <Route path="/ai" element={<AiUsage />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
