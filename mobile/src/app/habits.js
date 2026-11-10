import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Modal, Platform, ScrollView, View } from "react-native";
import { Icon } from "../components/icons";
import { Button, Card, ErrorBox, Field, Header, Icon3D, IconButton, Loading, Rise, Screen, T, TONES, Tap } from "../components/ui";
import { api } from "../lib/api";
import { useTheme } from "../lib/AppContext";
import { confirm } from "../lib/confirm";
import { useLoad } from "../lib/useLoad";

const ICONS = ["check", "book", "dumbbell", "water", "heart", "leaf", "moon", "sun", "wallet", "target", "sparkles", "clock", "phone", "chat", "flame"];
const TONE_KEYS = ["violet", "blue", "green", "amber", "pink", "indigo", "lime", "cyan", "orange", "red"];
const SUGGESTIONS = [
  { title: "Drink 8 glasses of water", icon: "water", tone: "cyan" },
  { title: "Read 10 pages", icon: "book", tone: "blue" },
  { title: "Walk 7,000 steps", icon: "dumbbell", tone: "green" },
  { title: "Meditate 5 minutes", icon: "moon", tone: "indigo" },
  { title: "No phone after 10 PM", icon: "phone", tone: "pink" },
  { title: "Save something today", icon: "wallet", tone: "amber" }
];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function Habits() {
  const t = useTheme();
  const { data, error, loading, reload, setData } = useLoad("/habits");
  const [sheet, setSheet] = useState(null); // null | { mode: "new" | "edit", habit? }

  if (loading && !data) return <Loading />;
  const habits = data?.habits ?? [];
  const doneCount = habits.filter((h) => h.done_today).length;

  async function toggle(h) {
    const done = !h.done_today;
    if (Platform.OS !== "web") Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Optimistic update; the server response (idempotent) is the source of truth.
    setData((d) => ({ ...d, habits: d.habits.map((x) => (x.id === h.id ? { ...x, done_today: done, streak: x.streak + (done ? 1 : x.done_today ? -1 : 0) } : x)) }));
    try {
      const r = await api(`/habits/${h.id}/check`, { method: "POST", body: { done } });
      setData(() => r);
    } catch {
      reload();
    }
  }

  return (
    <Screen>
      <Header title="Habits" right={<IconButton label="New habit" onPress={() => setSheet({ mode: "new" })}><Icon name="plus" color={t.text} size={18} /></IconButton>} />
      <ErrorBox error={error} onRetry={reload} />

      {habits.length > 0 && (
        <Rise>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Icon3D name="flame" tone="orange" size={42} />
            <View style={{ flex: 1 }}>
              <T v="h3">{doneCount === habits.length ? "All done today" : `${doneCount} of ${habits.length} done today`}</T>
              <T v="tiny" muted style={{ fontWeight: "500" }}>Tap a habit to check it off.</T>
            </View>
            <T v="h2" color={t.ink}>{Math.round((doneCount / habits.length) * 100)}%</T>
          </Card>
        </Rise>
      )}

      {habits.map((h, i) => (
        <Rise key={h.id} delay={Math.min(i, 8) * 30}>
          <HabitRow habit={h} onToggle={() => toggle(h)} onEdit={() => setSheet({ mode: "edit", habit: h })} />
        </Rise>
      ))}

      {!habits.length && !error && (
        <Rise>
          <Card style={{ gap: 10 }}>
            <T v="h3">Build habits that stick</T>
            <T v="small" muted>Pick one to start. Small daily wins add up.</T>
            {SUGGESTIONS.map((s) => (
              <Tap key={s.title} onPress={() => api("/habits", { method: "POST", body: s }).then((r) => setData(() => r)).catch(reload)} accessibilityRole="button">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
                  <Icon3D name={s.icon} tone={s.tone} size={32} />
                  <T v="small" style={{ flex: 1, fontWeight: "600" }}>{s.title}</T>
                  <Icon name="plus" color={t.ink} size={16} />
                </View>
              </Tap>
            ))}
            <Button small variant="secondary" icon="pencil" title="Create my own" onPress={() => setSheet({ mode: "new" })} />
          </Card>
        </Rise>
      )}

      <HabitSheet sheet={sheet} onClose={() => setSheet(null)} onSaved={(r) => { setData(() => r); setSheet(null); }} />
    </Screen>
  );
}

function HabitRow({ habit: h, onToggle, onEdit }) {
  const t = useTheme();
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
      <Tap onPress={onEdit} onLongPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${h.title}`} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Icon3D name={h.icon} tone={h.tone} size={40} />
        <View style={{ flex: 1, gap: 5 }}>
          <T v="small" style={{ fontWeight: "700" }} numberOfLines={1}>{h.title}</T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {h.last7.map((on, i) => (
              <View key={i} style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: on || (i === 6 && h.done_today) ? TONES[h.tone]?.[1] ?? t.acc : t.track }} />
            ))}
            <Icon name="flame" color={h.streak ? t.c2 : t.muted} size={13} />
            <T v="tiny" muted>{h.streak}</T>
          </View>
        </View>
      </Tap>
      <Tap guard={350} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: h.done_today }} accessibilityLabel={h.title} hitSlop={8}>
        <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: h.done_today ? TONES[h.tone]?.[1] ?? t.acc : "transparent", borderWidth: 2, borderColor: h.done_today ? "transparent" : t.muted }}>
          {h.done_today ? <Icon name="check" color="#FFFFFF" size={20} strokeWidth={2.8} /> : null}
        </View>
      </Tap>
    </Card>
  );
}

function HabitSheet({ sheet, onClose, onSaved }) {
  const t = useTheme();
  const editing = sheet?.mode === "edit";
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("check");
  const [tone, setTone] = useState("violet");
  const [error, setError] = useState(null);
  const [lastKey, setLastKey] = useState(null);
  const key = sheet ? `${sheet.mode}-${sheet.habit?.id ?? "new"}` : null;
  if (key && key !== lastKey) {
    setLastKey(key);
    setTitle(sheet.habit?.title ?? "");
    setIcon(sheet.habit?.icon ?? "check");
    setTone(sheet.habit?.tone ?? "violet");
    setError(null);
  }

  async function save() {
    setError(null);
    try {
      const body = { title: title.trim(), icon, tone };
      const r = editing ? await api(`/habits/${sheet.habit.id}`, { method: "PATCH", body }) : await api("/habits", { method: "POST", body });
      onSaved(r);
    } catch (err) {
      setError(err.fields?.title?.[0] || err.message);
    }
  }
  async function archive() {
    if (!(await confirm("Remove this habit?", "Its history will be deleted.", "Remove"))) return;
    try {
      onSaved(await api(`/habits/${sheet.habit.id}`, { method: "DELETE" }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal visible={Boolean(sheet)} transparent animationType="slide" onRequestClose={onClose}>
      <Tap guard={0} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ position: "absolute", left: 10, right: 10, bottom: 18, borderRadius: 24, padding: 16, gap: 12, backgroundColor: t.solid, borderWidth: 1, borderColor: t.line }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon3D name={icon} tone={tone} size={46} />
          <T v="h2" style={{ flex: 1 }}>{editing ? "Edit habit" : "New habit"}</T>
        </View>
        <Field placeholder="e.g. Read 10 pages" value={title} onChangeText={setTitle} maxLength={60} autoFocus={!editing} accessibilityLabel="Habit name" error={error} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {ICONS.map((i) => (
            <Tap key={i} guard={150} onPress={() => setIcon(i)} accessibilityRole="radio" accessibilityState={{ checked: icon === i }} accessibilityLabel={i}>
              <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: icon === i ? t.soft : t.s2, borderWidth: 1.5, borderColor: icon === i ? t.ink : "transparent" }}>
                <Icon name={i} color={icon === i ? t.ink : t.muted} size={20} />
              </View>
            </Tap>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {TONE_KEYS.map((k) => (
            <Tap key={k} guard={150} onPress={() => setTone(k)} accessibilityRole="radio" accessibilityState={{ checked: tone === k }} accessibilityLabel={k}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: TONES[k][1], borderWidth: tone === k ? 3 : 0, borderColor: t.text }} />
            </Tap>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {editing ? <Button style={{ flex: 1 }} small variant="danger" icon="trash" title="Remove" onPress={archive} /> : null}
          <Button style={{ flex: 1.4 }} small title={editing ? "Save" : "Add habit"} disabled={!title.trim()} onPress={save} />
        </View>
      </View>
    </Modal>
  );
}
