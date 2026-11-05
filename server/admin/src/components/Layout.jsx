import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

const THEME_KEY = "aba_admin_theme";

// "auto" follows the computer's light/dark setting.
function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "auto";
  } catch {
    return "auto";
  }
}

const NEXT = { auto: "light", light: "dark", dark: "auto" };
const LABEL = { auto: "Theme: Auto", light: "Theme: Light", dark: "Theme: Dark" };

const DARK_QUERY = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function useSystemDark() {
  const query = DARK_QUERY;
  const [dark, setDark] = useState(() => (query ? query.matches : true));
  useEffect(() => {
    if (!query) return undefined;
    const on = (e) => setDark(e.matches);
    query.addEventListener("change", on);
    return () => query.removeEventListener("change", on);
  }, [query]);
  return dark;
}

export function Layout({ me, onSignOut, children }) {
  const [theme, setTheme] = useState(readTheme);
  const systemDark = useSystemDark();
  useEffect(() => {
    document.documentElement.dataset.theme = theme === "auto" ? (systemDark ? "dark" : "light") : theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* private mode: theme just won't persist */
    }
  }, [theme, systemDark]);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>AppByAhmad Admin</span>
        </div>
        <nav className="nav" aria-label="Admin">
          <NavLink to="/" end>Overview</NavLink>
          <NavLink to="/users">Users</NavLink>
          <NavLink to="/activity">Activity</NavLink>
          <NavLink to="/notifications">Notifications</NavLink>
          <NavLink to="/plans">Plans &amp; payments</NavLink>
          <NavLink to="/ai">AI usage</NavLink>
          <NavLink to="/errors">Error logs</NavLink>
          <NavLink to="/audit">Audit log</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="side-foot">
          <span className="muted" title={me.email}>{me.email}</span>
          <button className="link" onClick={() => setTheme(NEXT[theme] ?? "auto")} title="Switch between auto, light and dark">
            {LABEL[theme] ?? LABEL.auto}
          </button>
          <button className="link" onClick={onSignOut}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
