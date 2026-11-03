import { router, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Loading } from "../components/ui";
import { AppProvider, useApp } from "../lib/AppContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Navigation />
      </AppProvider>
    </SafeAreaProvider>
  );
}

// Signed out -> welcome/sign-in. Signed in but new -> onboarding. Otherwise -> the app.
function Navigation() {
  const app = useApp();
  const segments = useSegments();

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
      </Stack>
    </>
  );
}
