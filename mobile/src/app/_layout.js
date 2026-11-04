import { router, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MaintenanceScreen } from "../components/MaintenanceScreen";
import { Loading } from "../components/ui";
import { AppProvider, useApp } from "../lib/AppContext";
import { AppConfigProvider, useAppConfig } from "../lib/appConfig";
import { AppErrorBoundary, installGlobalErrorHandler } from "../lib/errorReporting";
import { usePushRegistration } from "../lib/push";

installGlobalErrorHandler();

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AppProvider>
          <AppConfigProvider>
            <Navigation />
          </AppConfigProvider>
        </AppProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

// Signed out -> welcome/sign-in. Signed in but new -> onboarding. Otherwise -> the app.
function Navigation() {
  const app = useApp();
  const segments = useSegments();
  const { config, updateRequired } = useAppConfig();
  usePushRegistration(app.signedIn && app.onboarded);

  useEffect(() => {
    if (app.loading) return;
    const area = segments[0];
    if (!app.signedIn) {
      if (area !== "(auth)") router.replace("/welcome");
    } else if (!app.onboarded) {
      if (area !== "onboarding") router.replace("/onboarding");
    } else if (area === "(auth)" || area === "onboarding") {
      router.replace("/");
    }
  }, [app.loading, app.signedIn, app.onboarded, segments]);

  if (app.loading) return <Loading />;
  // Shown on top of the navigator (never instead of it), so redirects keep a mounted router.
  const blocked = updateRequired ? "update" : config.maintenance?.on && app.user?.role !== "admin" ? "maintenance" : null;
  const t = app.theme;
  return (
    <>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="goal/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="goal/[id]" />
        <Stack.Screen name="journal" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="premium" />
      </Stack>
      {blocked && (
        <View style={StyleSheet.absoluteFill}>
          <MaintenanceScreen updateRequired={blocked === "update"} />
        </View>
      )}
    </>
  );
}
