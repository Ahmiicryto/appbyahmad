import Constants from "expo-constants";
import { Component } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { API_URL } from "./api.js";

// Sends crashes to the server's /api/client-errors so they show in the admin Error logs.
// Never throws, never blocks the UI, and never sends user content: only the error itself.

const MAX_REPORTS = 20; // per app session
const DEDUPE_MS = 60 * 1000;

let token = null;
let sent = 0;
const recent = new Map(); // message -> last sent time
let installed = false;

const appVersion = () => Constants.expoConfig?.version ?? null;

// Call with the signed-in user's token (or null on sign-out) so reports are linked to the account.
export function setErrorReportingToken(t) {
  token = t || null;
}

export function reportError(error, extra = {}) {
  try {
    const message = String(error?.message || error || "Unknown error").slice(0, 2000);
    const now = Date.now();
    if (sent >= MAX_REPORTS) return;
    const last = recent.get(message);
    if (last && now - last < DEDUPE_MS) return;
    recent.set(message, now);
    sent += 1;

    const body = {
      message,
      stack: error?.stack ? String(error.stack).slice(0, 8000) : extra.stack ?? undefined,
      path: extra.path ?? undefined,
      level: extra.level ?? (extra.fatal ? "fatal" : "error"),
      platform: Platform.OS,
      app_version: appVersion() ?? undefined
    };
    fetch(`${API_URL}/api/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    }).catch(() => {});
  } catch {
    // Reporting must never cause a second crash.
  }
}

// Hooks React Native's global JS error handler and unhandled promise rejections. Safe to call more than once.
export function installGlobalErrorHandler() {
  if (installed) return;
  installed = true;
  try {
    const EU = globalThis.ErrorUtils;
    if (EU?.setGlobalHandler) {
      const previous = EU.getGlobalHandler?.();
      EU.setGlobalHandler((error, isFatal) => {
        reportError(error, { fatal: Boolean(isFatal) });
        if (typeof previous === "function") previous(error, isFatal);
      });
    }
  } catch {
    /* not available */
  }
  try {
    if (typeof globalThis.addEventListener === "function") {
      // Web builds.
      globalThis.addEventListener("unhandledrejection", (e) => reportError(e?.reason ?? "Unhandled promise rejection"));
    } else if (!__DEV__ && globalThis.HermesInternal?.enablePromiseRejectionTracker) {
      // Release builds on Hermes. Skipped in development so React Native's own warnings keep working.
      globalThis.HermesInternal.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled: (id, rejection) => reportError(rejection ?? "Unhandled promise rejection", { level: "warn" }),
        onHandled: () => {}
      });
    }
  } catch {
    /* not available */
  }
}

// Last line of defence for render errors. Plain styles so it works even if theming is what broke.
export class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportError(error, { stack: info?.componentStack, level: "fatal" });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: "#090C0A", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <Text style={{ color: "#EEF4EF", fontSize: 18, fontWeight: "700", textAlign: "center" }}>
          Something went wrong. Restart the app to continue.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.reset}
          style={({ pressed }) => ({
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#EEF4EF",
            opacity: pressed ? 0.7 : 1
          })}
        >
          <Text style={{ color: "#EEF4EF", fontSize: 16, fontWeight: "600" }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}
