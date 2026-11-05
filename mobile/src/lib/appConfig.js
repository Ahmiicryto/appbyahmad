import Constants from "expo-constants";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { API_URL } from "./api";

// Remote config set by the admin: maintenance, announcement, feature flags, minimum version.
const REFRESH_MS = 5 * 60 * 1000;

export const DEFAULT_CONFIG = {
  maintenance: { on: false, message: "" },
  announcement: null,
  features: { journal: true, money: false, fitness: false, nutrition: false, career: false, future_me: false, decisions: false, assistant: false },
  minAppVersion: "0.0.0",
  signupOpen: true,
  plansAvailable: 0,
  purchases: { enabled: false, iosKey: null, androidKey: null, entitlement: "premium" },
  legal: { termsUrl: null, privacyUrl: null, supportEmail: null }
};

export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

// True when `current` is older than `min` (both "major.minor.patch"; missing parts count as 0).
export function isVersionTooOld(min, current) {
  if (!min || !current) return false;
  const parse = (v) => String(v).split(/[.+-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  const a = parse(current);
  const b = parse(min);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}

function merge(remote) {
  return {
    ...DEFAULT_CONFIG,
    ...remote,
    maintenance: { ...DEFAULT_CONFIG.maintenance, ...(remote?.maintenance ?? {}) },
    features: { ...DEFAULT_CONFIG.features, ...(remote?.features ?? {}) },
    purchases: { ...DEFAULT_CONFIG.purchases, ...(remote?.purchases ?? {}) },
    legal: { ...DEFAULT_CONFIG.legal, ...(remote?.legal ?? {}) }
  };
}

const AppConfigContext = createContext({ config: DEFAULT_CONFIG, loading: false, refresh: async () => {}, updateRequired: false, appVersion: APP_VERSION });

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(null);

  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    setLoading(true);
    inFlight.current = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/app-config`, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (res.ok) setConfig(merge(await res.json()));
      } catch {
        // Offline: keep the last config we had (defaults on first launch).
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    let last = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && last !== "active") refresh();
      last = next;
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ config, loading, refresh, appVersion: APP_VERSION, updateRequired: isVersionTooOld(config.minAppVersion, APP_VERSION) }),
    [config, loading, refresh]
  );
  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export const useAppConfig = () => useContext(AppConfigContext);
