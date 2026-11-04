import Constants from "expo-constants";
import { useState } from "react";
import { Linking, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../lib/AppContext";
import { APP_VERSION, useAppConfig } from "../lib/appConfig";
import { Button, T } from "./ui";

// Full-screen block for maintenance mode, or (with `updateRequired`) for app versions the admin no longer supports.
export function MaintenanceScreen({ updateRequired = false, storeUrl }) {
  const t = useTheme();
  const { config, refresh } = useAppConfig();
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    setBusy(true);
    try {
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const title = updateRequired ? "Update required" : "We'll be right back";
  const body = updateRequired
    ? `This version (${APP_VERSION}) is no longer supported. Update the app to version ${config.minAppVersion} or later to keep going.`
    : config.maintenance.message || "We're improving the app. Please try again in a few minutes.";
  const pkg = Constants.expoConfig?.android?.package;
  const store =
    storeUrl ??
    (Platform.OS === "ios" ? Constants.expoConfig?.ios?.appStoreUrl : Platform.OS === "android" && pkg ? `market://details?id=${pkg}` : null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 28, gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }}>
          <T v="h2" color={t.ink}>{updateRequired ? "↑" : "…"}</T>
        </View>
        <T v="h1" accessibilityRole="header">{title}</T>
        <T muted>{body}</T>
        <View style={{ gap: 10, marginTop: 10 }}>
          {updateRequired && store && <Button title="Update the app" onPress={() => Linking.openURL(store).catch(() => {})} />}
          <Button title="Try again" variant={updateRequired ? "secondary" : "primary"} busy={busy} onPress={retry} />
        </View>
      </View>
    </SafeAreaView>
  );
}
