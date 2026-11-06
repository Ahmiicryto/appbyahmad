import { router } from "expo-router";
import { useState } from "react";
import { Linking, Modal, Platform, Pressable, Share, StyleSheet, View } from "react-native";
import { Icon } from "../components/icons";
import { Avatar, Button, Card, Chevron, Field, Glass, Header, IconButton, IconTile, Pill, Rise, Screen, T } from "../components/ui";
import Constants from "expo-constants";
import { api } from "../lib/api";
import { useApp, useTheme } from "../lib/AppContext";
import { useAppConfig } from "../lib/appConfig";
import { pickAvatar } from "../lib/avatar";
import { useLoad } from "../lib/useLoad";

export default function Profile() {
  const t = useTheme();
  const { user, profile, updateProfile, signOut, appearance } = useApp();
  const { config } = useAppConfig();
  const stats = useLoad("/profile/stats");
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const startEdit = () => {
    setForm({
      name: profile?.name || "",
      phone: profile?.phone || "",
      birth_date: profile?.birth_date ? String(profile.birth_date).slice(0, 10) : "",
      country: profile?.country || "",
      occupation: profile?.occupation || ""
    });
    setFieldErrors({});
    setError(null);
    setEditing(true);
  };

  async function saveEdit() {
    setBusy("save");
    setError(null);
    setFieldErrors({});
    try {
      await updateProfile({
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        birth_date: /^\d{4}-\d{2}-\d{2}$/.test(form.birth_date.trim()) ? form.birth_date.trim() : null,
        country: form.country.trim() || null,
        occupation: form.occupation.trim() || null
      });
      setEditing(false);
    } catch (err) {
      setFieldErrors(err.fields || {});
      setError(err.fields ? "Check the highlighted fields." : err.message);
    } finally {
      setBusy(null);
    }
  }

  async function setAvatar(value) {
    setBusy("avatar");
    setError(null);
    try {
      await updateProfile({ avatar: value });
      setSheet(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function choosePhoto(source) {
    try {
      const dataUrl = await pickAvatar(source);
      if (dataUrl) await setAvatar(dataUrl);
    } catch (err) {
      setError(err.message);
      setSheet(false);
    }
  }

  const s = stats.data;
  const since = s?.member_since ? new Date(s.member_since).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : null;
  const support = config.legal?.supportEmail;
  const fields = [
    ["user", "Full name", profile?.name],
    ["mail", "Email", user?.email, true],
    ["phone", "Phone", profile?.phone],
    ["cake", "Birthday", profile?.birth_date ? new Date(`${String(profile.birth_date).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null],
    ["globe", "Country · time zone", [profile?.country, profile?.timezone].filter(Boolean).join(" · ")],
    ["briefcase", "Work", profile?.occupation]
  ];
  const rows = [
    { title: "Settings", items: [
      ["bell", "Notifications", "", () => router.push("/notifications")],
      ["contrast", "Appearance & color", { auto: "Auto", light: "Light", dark: "Dark" }[appearance], () => router.push("/settings")],
      ["shield", "Privacy & security", "", () => router.push("/settings")],
      ["crown", "Plans & billing", user?.isPremium ? "Premium" : "Free", () => router.push("/premium")]
    ] },
    { title: "Support", items: [
      ["help", "Help & support", "", support ? () => Linking.openURL(`mailto:${support}`) : null],
      ["gift", "Invite friends", "", () => Share.share({ message: "I'm planning my life with AppByAhmad — goals, money, fitness and journal in one daily plan. Try it!" }).catch(() => {})],
      ["file", "Terms of use", "", config.legal?.termsUrl ? () => Linking.openURL(config.legal.termsUrl) : null],
      ["lock", "Privacy policy", "", config.legal?.privacyUrl ? () => Linking.openURL(config.legal.privacyUrl) : null]
    ].filter((r) => r[3]) }
  ];

  return (
    <Screen>
      <Header
        title="Profile"
        right={<IconButton label="Settings" onPress={() => router.push("/settings")}><Icon name="gear" color={t.text} size={19} /></IconButton>}
      />

      <Rise>
        <Card strong style={{ alignItems: "center", gap: 6, paddingTop: 22 }}>
          <View style={{ width: 112, height: 112, alignItems: "center", justifyContent: "center" }}>
            <Avatar profile={profile} size={104} />
            <Pressable
              onPress={() => setSheet(true)}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              hitSlop={6}
              style={{ position: "absolute", right: 0, bottom: 2, width: 38, height: 38, borderRadius: 19, backgroundColor: t.acc, borderWidth: 2, borderColor: t.bg, alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="camera" color={t.onAcc} size={17} />
            </Pressable>
          </View>
          <T v="h2" style={{ marginTop: 6, textAlign: "center" }}>{profile?.name || "Add your name"}</T>
          <T v="small" muted>{user?.email}</T>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
            {user?.isPremium ? <Pill icon="crown">Premium</Pill> : <Pill bg={t.s2} color={t.muted}>Free plan</Pill>}
            {since ? <Pill icon="calendar" bg={t.s2} color={t.muted}>Member since {since}</Pill> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignSelf: "stretch", marginTop: 10 }}>
            <Stat icon="flame" v={s?.streak ?? "–"} l="Day streak" />
            <Stat icon="target" v={s?.goals ?? "–"} l="Active goals" />
            <Stat icon="book" v={s?.journal ?? "–"} l="Journal entries" />
          </View>
        </Card>
      </Rise>

      <Rise delay={60}>
        <Pressable onPress={() => router.push("/premium")} accessibilityRole="button" accessibilityLabel={user?.isPremium ? "Manage your plan" : "See Premium plans"}>
          {({ pressed }) => (
            <Glass radius={24} border={t.pbd} style={{ padding: 16, gap: 12, backgroundColor: t.soft, opacity: pressed ? 0.9 : 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: t.acc, borderWidth: 1, borderColor: t.pbd, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="crown" color={t.onAcc} size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="tiny" color={t.ink} style={{ letterSpacing: 1, textTransform: "uppercase", fontWeight: "800" }}>Your plan</T>
                  <T v="h3">{user?.isPremium ? "Premium" : "Free"}</T>
                  <T v="small" muted>
                    {user?.isPremium
                      ? user.plan_expires_at ? `Renews or ends ${new Date(user.plan_expires_at).toLocaleDateString()}` : "Active"
                      : "Unlock unlimited goals and every life area"}
                  </T>
                </View>
                <Chevron color={t.muted} dir="right" />
              </View>
              <View style={{ minHeight: 42, borderRadius: 14, backgroundColor: t.acc, borderWidth: 1, borderColor: t.pbd, alignItems: "center", justifyContent: "center" }}>
                <T v="small" color={t.onAcc} style={{ fontWeight: "800" }}>{user?.isPremium ? "Manage plan" : "See Premium plans"}</T>
              </View>
            </Glass>
          )}
        </Pressable>
      </Rise>

      <Rise delay={120}>
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <T v="h3">Personal info</T>
            {editing ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button title="Cancel" small variant="secondary" onPress={() => setEditing(false)} />
                <Button title="Save" small onPress={saveEdit} busy={busy === "save"} />
              </View>
            ) : (
              <Button title="Edit" icon="pencil" small variant="secondary" onPress={startEdit} />
            )}
          </View>
          {editing ? (
            <View style={{ gap: 12 }}>
              <Field label="Full name" icon="user" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoComplete="name" error={fieldErrors.name?.[0]} />
              <Field label="Phone" icon="phone" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" autoComplete="tel" placeholder="+92 300 1234567" error={fieldErrors.phone?.[0]} />
              <Field label="Birthday (YYYY-MM-DD)" icon="cake" value={form.birth_date} onChangeText={(v) => setForm((f) => ({ ...f, birth_date: v }))} placeholder="1996-08-12" keyboardType="numbers-and-punctuation" error={fieldErrors.birth_date?.[0]} />
              <Field label="Country" icon="globe" value={form.country} onChangeText={(v) => setForm((f) => ({ ...f, country: v }))} autoComplete="country" placeholder="Pakistan" error={fieldErrors.country?.[0]} />
              <Field label="Work" icon="briefcase" value={form.occupation} onChangeText={(v) => setForm((f) => ({ ...f, occupation: v }))} placeholder="Designer" error={fieldErrors.occupation?.[0]} />
              <T v="small" muted>To change your email, contact support.</T>
            </View>
          ) : (
            fields.map(([e, label, value, verified], i) => (
              <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, borderBottomWidth: i === fields.length - 1 ? 0 : StyleSheet.hairlineWidth, borderColor: t.line }}>
                <IconTile name={e} />
                <View style={{ flex: 1 }}>
                  <T v="tiny" muted style={{ fontWeight: "700" }}>{label}</T>
                  <T style={{ fontWeight: "700" }} color={value ? t.text : t.muted} numberOfLines={1}>{value || "Not added"}</T>
                </View>
                {verified ? <Pill bg={t.soft} color={t.good} icon="check">Verified</Pill> : null}
              </View>
            ))
          )}
          {error ? <T color={t.bad} style={{ fontWeight: "600" }}>{error}</T> : null}
        </Card>
      </Rise>

      {rows.map((g, gi) => (
        <Rise key={g.title} delay={180 + gi * 60}>
          <Card style={{ gap: 0, paddingVertical: 10 }}>
            <T v="tiny" muted style={{ letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "800", marginBottom: 2 }}>{g.title}</T>
            {g.items.map(([e, label, value, onPress], i) => (
              <Pressable key={label} onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, opacity: pressed ? 0.7 : 1, borderBottomWidth: i === g.items.length - 1 ? 0 : StyleSheet.hairlineWidth, borderColor: t.line })}>
                <IconTile name={e} />
                <T style={{ flex: 1, fontWeight: "600" }}>{label}</T>
                {value ? <T v="small" muted style={{ fontWeight: "700" }}>{value}</T> : null}
                <Chevron color={t.muted} dir="right" size={16} />
              </Pressable>
            ))}
          </Card>
        </Rise>
      ))}

      <Button title="Sign out" icon="logout" variant="secondary" onPress={signOut} />
      <T v="tiny" muted style={{ textAlign: "center" }}>AppByAhmad · Version {Constants.expoConfig?.version ?? "1.0.0"}</T>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setSheet(false)} accessibilityLabel="Close" />
        <View style={{ position: "absolute", left: 10, right: 10, bottom: Platform.OS === "ios" ? 28 : 12, borderRadius: 30, padding: 16, gap: 12, backgroundColor: t.solid, borderWidth: 1, borderColor: t.line }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.track, alignSelf: "center" }} />
          <T v="h3" style={{ textAlign: "center" }}>Profile photo</T>
          {Platform.OS !== "web" ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button style={{ flex: 1 }} variant="secondary" icon="camera" title="Take photo" onPress={() => choosePhoto("camera")} disabled={busy === "avatar"} />
              <Button style={{ flex: 1 }} variant="secondary" icon="image" title="Choose" onPress={() => choosePhoto("library")} disabled={busy === "avatar"} />
            </View>
          ) : (
            <Button variant="secondary" icon="image" title="Choose a photo" onPress={() => choosePhoto("library")} disabled={busy === "avatar"} />
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {profile?.avatar ? <Button style={{ flex: 1 }} small variant="danger" title="Remove photo" onPress={() => setAvatar(null)} busy={busy === "avatar"} /> : null}
            <Button style={{ flex: 1 }} small title="Done" onPress={() => setSheet(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Stat({ icon, v, l }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 4, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 16, backgroundColor: t.s2, borderWidth: 1, borderColor: t.line }}>
      <Icon name={icon} color={t.ink} size={16} />
      <T v="h2">{v}</T>
      <T v="tiny" muted numberOfLines={1} style={{ fontWeight: "600" }}>{l}</T>
    </View>
  );
}
