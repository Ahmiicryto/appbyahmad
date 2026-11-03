import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

const THEME_KEY = "aba_admin_theme";

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "dark";
  } catch {
    return "dark";
  }
}

export function Layout({ me, onSignOut, children }) {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* private mode: theme just won't persist */
    }
  }, [theme]);

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
          <NavLink to="/ai">AI usage</NavLink>
          <NavLink to="/audit">Audit log</NavLink>
        </nav>
        <div className="side-foot">
          <span className="muted" title={me.email}>{me.email}</span>
          <button className="link" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button className="link" onClick={onSignOut}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
