import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, Field, Rise, Screen, T } from "../components/ui";
import { api } from "../lib/api";
import { useApp, useTheme } from "../lib/AppContext";
import { confirm } from "../lib/confirm";
import { THEMES } from "../theme/themes";

export default function Settings() {
  const t = useTheme();
  const { user, profile, themeKey, updateProfile, signOut } = useApp();
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState(null);
  const [showDelete, setShowDelete] = useState(false);

  async function deleteAccount() {
    if (!(await confirm("Delete your account?", "All your goals, tasks and journal entries will be permanently deleted.", "Delete account"))) return;
    setDeleteError(null);
    try {
      await api("/auth/me", { method: "DELETE", body: { password } });
      await signOut();
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
        <T color={t.ink} style={{ fontWeight: "700" }}>← Back</T>
      </Pressable>
      <Rise><T v="h1">Settings</T></Rise>

      <Rise delay={60}>
        <Card>
          <T v="h3">{profile?.name || "Your profile"}</T>
          <T v="small" muted>{user?.email}</T>
          <T v="small" muted>Plan: {user?.isPremium ? "Premium" : "Free"}</T>
        </Card>
      </Rise>

      <Rise delay={120} style={{ gap: 10 }}>
        <T v="h3">Theme</T>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {Object.entries(THEMES).map(([key, th]) => {
            const sel = key === themeKey;
            return (
              <Pressable
                key={key}
                onPress={() => updateProfile({ theme: key })}
                accessibilityRole="radio"
                accessibilityState={{ checked: sel }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, padding: 10, borderRadius: 16, borderWidth: 1.5, borderColor: sel ? t.ink : t.line, backgroundColor: sel ? t.soft : t.s1 }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: th.bg, borderWidth: 1, borderColor: th.line, alignItems: "center", justifyContent: "center" }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: th.acc }} />
                </View>
                <T style={{ fontWeight: "700", flex: 1 }}>{th.name}</T>
                {sel && <T v="small" color={t.ink} style={{ fontWeight: "800" }}>Selected</T>}
              </Pressable>
            );
          })}
        </View>
      </Rise>

      {!user?.isPremium && (
        <Rise delay={180}>
          <Card highlight={t.ink}>
            <T v="h3">Premium · $12.99/month</T>
            <T muted>Unlimited goals, adaptive plans, full Money, Fitness, Career, Future Me and the Assistant. In-app purchase arrives with the store release.</T>
          </Card>
        </Rise>
      )}

      <Button title="Sign out" variant="secondary" onPress={signOut} />

      {!showDelete ? (
        <Button title="Delete my account" variant="danger" onPress={() => setShowDelete(true)} />
      ) : (
        <Card highlight={t.bad}>
          <T v="h3">Delete account</T>
          <T muted>Enter your password to permanently delete your account and all your data.</T>
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
          {deleteError ? <T color={t.bad}>{deleteError}</T> : null}
          <Button title="Delete my account" variant="danger" onPress={deleteAccount} disabled={!password} />
          <Button title="Keep my account" variant="secondary" onPress={() => setShowDelete(false)} />
        </Card>
      )}
    </Screen>
  );
}
