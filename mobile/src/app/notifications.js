import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, Switch, View } from "react-native";
import { Card, ErrorBox, Header, Rise, Screen, T } from "../components/ui";
import { api } from "../lib/api";
import { useTheme } from "../lib/AppContext";
import { useLoad } from "../lib/useLoad";

const PREFS = [
  { key: "push", label: "Push notifications", hint: "Alerts on this phone, even when the app is closed." },
  { key: "reminders", label: "Reminders", hint: "Nudges about today's tasks and goals." },
  { key: "announcements", label: "Announcements", hint: "News and updates from us." }
];

function when(d) {
  const date = new Date(d);
  const s = (Date.now() - date.getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function open(url) {
  if (typeof url !== "string" || !url) return;
  if (url.startsWith("/")) router.push(url);
  else if (/^https:\/\//i.test(url)) Linking.openURL(url).catch(() => {});
}

export default function Notifications() {
  const t = useTheme();
  const { data, error, reload, setData } = useLoad("/notifications");
  const items = data?.notifications ?? [];
  const unread = items.filter((n) => !n.read).length;

  async function tap(n) {
    if (!n.read) {
      setData((d) => ({ ...d, notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }));
      api(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
    }
    open(n.data?.url);
  }

  async function readAll() {
    setData((d) => ({ ...d, notifications: d.notifications.map((x) => ({ ...x, read: true })) }));
    await api("/notifications/read-all", { method: "POST" }).catch(() => reload());
  }

  return (
    <Screen>
      <Header
        title="Notifications"
        right={unread > 0 ? (
          <Pressable onPress={readAll} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 6 }}>
            <T v="small" color={t.ink} style={{ fontWeight: "800" }}>Read all</T>
          </Pressable>
        ) : null}
      />

      <ErrorBox error={error} onRetry={reload} />
      {data && items.length === 0 && (
        <Card>
          <T muted>No notifications yet. Reminders and updates will show up here.</T>
        </Card>
      )}

      {items.map((n, i) => (
        <Rise key={n.id} delay={Math.min(i, 8) * 40}>
          <Pressable
            onPress={() => tap(n)}
            accessibilityRole="button"
            accessibilityLabel={`${n.read ? "" : "Unread. "}${n.title}. ${n.body}`}
            accessibilityHint={n.data?.url ? "Opens the related screen" : undefined}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Card style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }} highlight={n.read ? undefined : t.ink}>
              <View style={{ width: 10, paddingTop: 6 }}>
                {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.ink }} />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <T v="h3" style={{ flex: 1 }}>{n.title}</T>
                  <T v="small" muted>{when(n.created_at)}</T>
                </View>
                <T muted={n.read} style={{ lineHeight: 21 }}>{n.body}</T>
              </View>
            </Card>
          </Pressable>
        </Rise>
      ))}

      <T v="h3" style={{ marginTop: 12 }}>Notification settings</T>
      <PrefsCard />
    </Screen>
  );
}

function PrefsCard() {
  const t = useTheme();
  const { data, error, reload } = useLoad("/notifications/preferences");
  const [prefs, setPrefs] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (data?.preferences) setPrefs(data.preferences);
  }, [data]);

  async function toggle(key, value) {
    const before = prefs;
    setPrefs({ ...prefs, [key]: value });
    setSaveError(null);
    try {
      const r = await api("/notifications/preferences", { method: "PATCH", body: { [key]: value } });
      setPrefs(r.preferences);
    } catch (err) {
      setPrefs(before);
      setSaveError(`Couldn't save that change. ${err.message}`);
    }
  }

  if (error && !prefs) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <Card style={{ gap: 4 }}>
      {PREFS.map((p, i) => (
        <View
          key={p.key}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <T style={{ fontWeight: "700" }}>{p.label}</T>
            <T v="small" muted>{p.hint}</T>
          </View>
          <Switch
            value={Boolean(prefs?.[p.key])}
            disabled={!prefs}
            onValueChange={(v) => toggle(p.key, v)}
            trackColor={{ false: t.track, true: t.acc }}
            thumbColor={t.dark ? t.text : undefined}
            activeThumbColor={t.dark ? t.text : "#FFFFFF"}
            ios_backgroundColor={t.track}
            accessibilityLabel={p.label}
          />
        </View>
      ))}
      {saveError ? <T v="small" color={t.bad}>{saveError}</T> : null}
    </Card>
  );
}
