import { go } from "../lib/nav";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Chevron, Field, Glass, Header, IconTile, Rise, Screen, Segmented, T, Tap } from "../components/ui";
import { api } from "../lib/api";
import { useApp, useTheme } from "../lib/AppContext";
import { confirm } from "../lib/confirm";
import { COLOR_CHOICES } from "../theme/themes";

const APPEARANCES = [
  { value: "auto", label: "Auto", icon: "contrast" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" }
];

export default function Settings() {
  const t = useTheme();
  const { user, themeKey, appearance, updateProfile, signOut } = useApp();
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const colorKey = themeKey === "female" ? "female" : "male";

  async function save(fields) {
    setSaveError(null);
    try {
      await updateProfile(fields);
    } catch (err) {
      setSaveError(err.message);
    }
  }

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
      <Header title="Settings" />

      <Rise delay={40}>
        <Card>
          <T v="h3">Appearance</T>
          <Segmented label="Light or dark" value={appearance} onChange={(v) => save({ appearance: v })} options={APPEARANCES} />
          <T v="small" muted>Auto switches with your phone's light and dark setting.</T>
          <View accessibilityRole="radiogroup" accessibilityLabel="Color" style={{ flexDirection: "row", gap: 8 }}>
            {COLOR_CHOICES.map((c) => {
              const sel = c.key === colorKey;
              return (
                <Tap key={c.key} onPress={() => save({ theme: c.key })} accessibilityRole="radio" accessibilityState={{ checked: sel }} accessibilityLabel={c.label} style={{ flex: 1 }}>
                  <Glass radius={16} border={sel ? t.ink : undefined} strong={!sel} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, padding: 10, borderWidth: 1.5, backgroundColor: sel ? t.soft : t.s2 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: c.hex }} />
                    <View>
                      <T v="small" style={{ fontWeight: "800" }}>{c.label}</T>
                      <T v="tiny" muted>{c.hex}</T>
                    </View>
                  </Glass>
                </Tap>
              );
            })}
          </View>
          {saveError ? <T color={t.bad}>{saveError}</T> : null}
        </Card>
      </Rise>

      <Rise delay={90}>
        <Card style={{ gap: 0, paddingVertical: 8 }}>
          <Row e="bell" label="Notifications" sub="Push, reminders and news" onPress={() => go("/notifications")} />
          <Row e="user" label="Profile" sub="Photo, name and personal info" onPress={() => go("/profile")} />
          <Row e="crown" label={user?.isPremium ? "Premium" : "Get Premium"} sub={user?.isPremium ? "Manage your subscription" : "Unlimited goals and every life area"} onPress={() => go("/premium")} last />
        </Card>
      </Rise>

      <Rise delay={140} style={{ gap: 10 }}>
        <Button title="Sign out" icon="logout" variant="secondary" onPress={signOut} />
        {!showDelete ? (
          <Button title="Delete my account" icon="trash" variant="danger" onPress={() => setShowDelete(true)} />
        ) : (
          <Card highlight={t.bad}>
            <T v="h3">Delete account</T>
            <T muted>Enter your password to permanently delete your account and all your data. If you have a subscription, cancel it in your App Store or Google Play settings too.</T>
            <Field label="Password" icon="key" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
            {deleteError ? <T color={t.bad}>{deleteError}</T> : null}
            <Button title="Delete my account" variant="danger" onPress={deleteAccount} disabled={!password} />
            <Button title="Keep my account" variant="secondary" onPress={() => setShowDelete(false)} />
          </Card>
        )}
      </Rise>
    </Screen>
  );
}

function Row({ e, label, sub, onPress, last }) {
  const t = useTheme();
  return (
    <Tap onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, opacity: pressed ? 0.7 : 1, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderColor: t.line })}>
      <IconTile name={e} />
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: "800" }}>{label}</T>
        <T v="small" muted>{sub}</T>
      </View>
      <Chevron color={t.muted} dir="right" size={16} />
    </Tap>
  );
}
