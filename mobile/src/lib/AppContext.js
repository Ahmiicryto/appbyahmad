import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { THEMES } from "../theme/themes";
import { api, setAuthToken, setUnauthorizedHandler } from "./api";
import { getItem, setItem } from "./storage";

const TOKEN_KEY = "aba_token";
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState({ loading: true, token: null, user: null, profile: null });
  // Lets onboarding preview a theme before it is saved.
  const [previewTheme, setPreviewTheme] = useState(null);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    await setItem(TOKEN_KEY, null);
    setState({ loading: false, token: null, user: null, profile: null });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    (async () => {
      const token = await getItem(TOKEN_KEY);
      if (!token) return setState((s) => ({ ...s, loading: false }));
      setAuthToken(token);
      try {
        const me = await api("/auth/me");
        setState({ loading: false, token, user: me.user, profile: me.profile });
      } catch (err) {
        // Offline: keep the session; the screens will show a retry state.
        if (err.status === 0) setState({ loading: false, token, user: null, profile: null });
        else await signOut();
      }
    })();
  }, [signOut]);

  const signIn = useCallback(async (mode, email, password) => {
    const r = await api(mode === "register" ? "/auth/register" : "/auth/login", { method: "POST", body: { email, password } });
    setAuthToken(r.token);
    await setItem(TOKEN_KEY, r.token);
    setState({ loading: false, token: r.token, user: r.user, profile: r.profile });
  }, []);

  const updateProfile = useCallback(async (fields) => {
    const r = await api("/profile", { method: "PATCH", body: fields });
    setState((s) => ({ ...s, profile: r.profile }));
    return r.profile;
  }, []);

  const value = useMemo(() => {
    const themeKey = previewTheme || state.profile?.theme || "male";
    return {
      ...state,
      signedIn: Boolean(state.token),
      onboarded: Boolean(state.profile?.onboarded),
      theme: THEMES[themeKey] ?? THEMES.male,
      themeKey,
      setPreviewTheme,
      signIn,
      signOut,
      updateProfile
    };
  }, [state, previewTheme, signIn, signOut, updateProfile]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
export const useTheme = () => useContext(AppContext).theme;
