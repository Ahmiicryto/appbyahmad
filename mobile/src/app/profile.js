import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Linking, Modal, Platform, Pressable, Share, StyleSheet, View } from "react-native";
import { Avatar, Button, Card, Chevron, Emoji, Field, Glass, Header, IconButton, Pill, Rise, Screen, T } from "../components/ui";
import Constants from "expo-constants";
import { api } from "../lib/api";
import { useApp, useTheme } from "../lib/AppContext";
import { useAppConfig } from "../lib/appConfig";
import { pickAvatar } from "../lib/avatar";
import { useLoad } from "../lib/useLoad";

const EMOJI_AVATARS = ["😎", "🦁", "🚀", "🌸", "🦋", "🌙", "🐼", "🔥", "🌈", "⚡", "🦊", "💎"];

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
    ["👤", "Full name", profile?.name],
    ["✉️", "Email", user?.email, true],
    ["📱", "Phone", profile?.phone],
    ["🎂", "Birthday", profile?.birth_date ? new Date(`${String(profile.birth_date).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null],
    ["🌍", "Country · time zone", [profile?.country, profile?.timezone].filter(Boolean).join(" · ")],
    ["💼", "Work", profile?.occupation]
  ];
  const rows = [
    { title: "Settings", items: [
      ["🔔", "Notifications", "", () => router.push("/notifications")],
      ["🎨", "Appearance & color", { auto: "Auto", light: "Light", dark: "Dark" }[appearance], () => router.push("/settings")],
      ["🔒", "Privacy & security", "", () => router.push("/settings")],
      ["👑", "Plans & billing", user?.isPremium ? "Premium" : "Free", () => router.push("/premium")]
    ] },
    { title: "Support", items: [
      ["❓", "Help & support", "", support ? () => Linking.openURL(`mailto:${support}`) : null],
      ["🎁", "Invite friends", "", () => Share.share({ message: "I'm planning my life with AppByAhmad — goals, money, fitness and journal in one daily plan. Try it!" }).catch(() => {})],
      ["📜", "Terms of use", "", config.legal?.termsUrl ? () => Linking.openURL(config.legal.termsUrl) : null],
      ["🛡️", "Privacy policy", "", config.legal?.privacyUrl ? () => Linking.openURL(config.legal.privacyUrl) : null]
    ].filter((r) => r[3]) }
  ];

  return (
    <Screen>
      <Header
        title="Profile"
        right={<IconButton label="Settings" onPress={() => router.push("/settings")}><Emoji e="⚙️" size={19} anim="spin" /></IconButton>}
      />

      <Rise>
        <Card strong style={{ alignItems: "center", gap: 6, paddingTop: 22 }}>
          <View style={{ width: 112, height: 112, alignItems: "center", justifyContent: "center" }}>
            <SpinRing size={112} />
            <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
              <Avatar profile={profile} size={96} />
            </View>
            <Pressable
              onPress={() => setSheet(true)}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              hitSlop={6}
              style={{ position: "absolute", right: 0, bottom: 2, width: 38, height: 38, borderRadius: 19, backgroundColor: t.acc, borderWidth: 2, borderColor: t.bg, alignItems: "center", justifyContent: "center" }}
            >
              <T style={{ fontSize: 16 }}>📷</T>
            </Pressable>
          </View>
          <T v="h2" style={{ marginTop: 6, textAlign: "center" }}>{profile?.name || "Add your name"}</T>
          <T v="small" muted>{user?.email}</T>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
            {user?.isPremium ? <Pill emoji="👑">Premium</Pill> : <Pill emoji="🌱" bg={t.s2} color={t.muted}>Free plan</Pill>}
            {since ? <Pill emoji="🗓️" bg={t.s2} color={t.muted}>Member since {since}</Pill> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignSelf: "stretch", marginTop: 10 }}>
            <Stat e="🔥" anim="flame" v={s?.streak ?? "–"} l="day streak" />
            <Stat e="🎯" v={s?.goals ?? "–"} l="active goals" />
            <Stat e="📓" v={s?.journal ?? "–"} l="journal entries" />
          </View>
        </Card>
      </Rise>

      <Rise delay={60}>
        <Pressable onPress={() => router.push("/premium")} accessibilityRole="button" accessibilityLabel={user?.isPremium ? "Manage your plan" : "See Premium plans"}>
          {({ pressed }) => (
            <Glass radius={24} border={t.pbd} style={{ padding: 16, gap: 12, backgroundColor: t.soft, opacity: pressed ? 0.9 : 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: t.acc, borderWidth: 1, borderColor: t.pbd, alignItems: "center", justifyContent: "center" }}>
                  <Emoji e="👑" size={22} anim="shine" />
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
                <T v="small" color={t.onAcc} style={{ fontWeight: "800" }}>{user?.isPremium ? "💳 Manage plan" : "✨ See Premium plans"}</T>
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
              <Button title="Edit" emoji="✏️" small variant="secondary" onPress={startEdit} />
            )}
          </View>
          {editing ? (
            <View style={{ gap: 12 }}>
              <Field label="Full name" emoji="👤" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoComplete="name" error={fieldErrors.name?.[0]} />
              <Field label="Phone" emoji="📱" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" autoComplete="tel" placeholder="+92 300 1234567" error={fieldErrors.phone?.[0]} />
              <Field label="Birthday (YYYY-MM-DD)" emoji="🎂" value={form.birth_date} onChangeText={(v) => setForm((f) => ({ ...f, birth_date: v }))} placeholder="1996-08-12" keyboardType="numbers-and-punctuation" error={fieldErrors.birth_date?.[0]} />
              <Field label="Country" emoji="🌍" value={form.country} onChangeText={(v) => setForm((f) => ({ ...f, country: v }))} autoComplete="country" placeholder="Pakistan" error={fieldErrors.country?.[0]} />
              <Field label="Work" emoji="💼" value={form.occupation} onChangeText={(v) => setForm((f) => ({ ...f, occupation: v }))} placeholder="Designer" error={fieldErrors.occupation?.[0]} />
              <T v="small" muted>To change your email, contact support.</T>
            </View>
          ) : (
            fields.map(([e, label, value, verified], i) => (
              <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, borderBottomWidth: i === fields.length - 1 ? 0 : StyleSheet.hairlineWidth, borderColor: t.line }}>
                <RowIcon e={e} />
                <View style={{ flex: 1 }}>
                  <T v="tiny" muted style={{ fontWeight: "700" }}>{label}</T>
                  <T style={{ fontWeight: "700" }} color={value ? t.text : t.muted} numberOfLines={1}>{value || "Not added"}</T>
                </View>
                {verified ? <Pill bg={t.soft} color={t.good}>✓ Verified</Pill> : null}
              </View>
            ))
          )}
          {error ? <T color={t.bad} style={{ fontWeight: "700" }}>😕 {error}</T> : null}
        </Card>
      </Rise>

      {rows.map((g, gi) => (
        <Rise key={g.title} delay={180 + gi * 60}>
          <Card style={{ gap: 0, paddingVertical: 10 }}>
            <T v="tiny" muted style={{ letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "800", marginBottom: 2 }}>{g.title}</T>
            {g.items.map(([e, label, value, onPress], i) => (
              <Pressable key={label} onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, opacity: pressed ? 0.7 : 1, borderBottomWidth: i === g.items.length - 1 ? 0 : StyleSheet.hairlineWidth, borderColor: t.line })}>
                <RowIcon e={e} />
                <T style={{ flex: 1, fontWeight: "700" }}>{label}</T>
                {value ? <T v="small" muted style={{ fontWeight: "700" }}>{value}</T> : null}
                <Chevron color={t.muted} dir="right" size={16} />
              </Pressable>
            ))}
          </Card>
        </Rise>
      ))}

      <Button title="Sign out" emoji="🚪" variant="secondary" onPress={signOut} />
      <T v="tiny" muted style={{ textAlign: "center" }}>AppByAhmad · Version {Constants.expoConfig?.version ?? "1.0.0"}</T>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setSheet(false)} accessibilityLabel="Close" />
        <View style={{ position: "absolute", left: 10, right: 10, bottom: Platform.OS === "ios" ? 28 : 12, borderRadius: 30, padding: 16, gap: 12, backgroundColor: t.solid, borderWidth: 1, borderColor: t.line }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.track, alignSelf: "center" }} />
          <T v="h3" style={{ textAlign: "center" }}>Profile photo</T>
          {Platform.OS !== "web" && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button style={{ flex: 1 }} variant="secondary" emoji="📸" title="Take photo" onPress={() => choosePhoto("camera")} disabled={busy === "avatar"} />
              <Button style={{ flex: 1 }} variant="secondary" emoji="🖼️" title="Choose" onPress={() => choosePhoto("library")} disabled={busy === "avatar"} />
            </View>
          )}
          {Platform.OS === "web" && <Button variant="secondary" emoji="🖼️" title="Choose a photo" onPress={() => choosePhoto("library")} disabled={busy === "avatar"} />}
          <T v="tiny" muted style={{ letterSpacing: 1, textTransform: "uppercase", fontWeight: "800" }}>Or pick an emoji</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {EMOJI_AVATARS.map((e) => {
              const sel = profile?.avatar === e;
              return (
                <Pressable key={e} onPress={() => setAvatar(e)} accessibilityRole="button" accessibilityLabel={`Use ${e} as your avatar`} style={{ width: "14.5%", aspectRatio: 1, borderRadius: 14, borderWidth: 1.5, borderColor: sel ? t.ink : t.line, backgroundColor: sel ? t.soft : t.s2, alignItems: "center", justifyContent: "center" }}>
                  <T style={{ fontSize: 24 }}>{e}</T>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {profile?.avatar ? <Button style={{ flex: 1 }} small variant="danger" title="Remove photo" onPress={() => setAvatar(null)} busy={busy === "avatar"} /> : null}
            <Button style={{ flex: 1 }} small title="Done" onPress={() => setSheet(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Stat({ e, v, l, anim }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2, paddingVertical: 10, borderRadius: 18, backgroundColor: t.s2, borderWidth: 1, borderColor: t.line }}>
      <Emoji e={e} size={20} anim={anim} />
      <T v="h2">{v}</T>
      <T v="tiny" muted numberOfLines={1}>{l}</T>
    </View>
  );
}

function RowIcon({ e }) {
  const t = useTheme();
  return (
    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.s2, borderWidth: 1, borderColor: t.line, alignItems: "center", justifyContent: "center" }}>
      <T style={{ fontSize: 17 }}>{e}</T>
    </View>
  );
}

// Slowly rotating gradient ring around the avatar.
function SpinRing({ size }) {
  const t = useTheme();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, overflow: "hidden", transform: [{ rotate: a.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
      <LinearGradient colors={[t.acc, t.ink, t.c2, t.acc]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}
