import { router } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Button, Card, ErrorBox, Field, Rise, Screen, T } from "../components/ui";
import { api } from "../lib/api";
import { useTheme } from "../lib/AppContext";
import { confirm } from "../lib/confirm";
import { useLoad } from "../lib/useLoad";

const MOODS = [
  { key: "happy", label: "Happy", mouth: "M10 18c2.5 3 7.5 3 10 0" },
  { key: "good", label: "Good", mouth: "M11 18.5c2 1.5 6 1.5 8 0" },
  { key: "neutral", label: "Neutral", mouth: "M11 19h8" },
  { key: "sad", label: "Sad", mouth: "M10.5 20.5c2.5-2.5 6.5-2.5 9 0" },
  { key: "stressed", label: "Stressed", mouth: "M10 19.5l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5" }
];

export default function Journal() {
  const t = useTheme();
  const [mood, setMood] = useState(null);
  const [body, setBody] = useState("");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const { data, error, reload } = useLoad(`/journal${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await api("/journal", { method: "POST", body: { body, ...(mood ? { mood } : {}) } });
      setBody("");
      setMood(null);
      reload();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry) {
    if (!(await confirm("Delete this entry?", "It will be permanently deleted. This can't be undone.", "Delete entry"))) return;
    await api(`/journal/${entry.id}`, { method: "DELETE" }).catch(() => {});
    reload();
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
        <T color={t.ink} style={{ fontWeight: "700" }}>← Back</T>
      </Pressable>
      <Rise><T v="h1">How are you feeling today?</T></Rise>

      <Rise delay={60} style={{ flexDirection: "row", gap: 6 }} accessibilityRole="radiogroup">
        {MOODS.map((m) => {
          const sel = mood === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMood(sel ? null : m.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: sel }}
              accessibilityLabel={m.label}
              style={{ flex: 1, alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: sel ? t.ink : t.line, backgroundColor: sel ? t.soft : t.s1, transform: [{ scale: sel ? 1.06 : 1 }] }}
            >
              <Svg width={30} height={30} viewBox="0 0 30 30" fill="none" stroke={sel ? t.ink : t.muted} strokeWidth={2} strokeLinecap="round">
                <Circle cx="15" cy="15" r="12" />
                <Circle cx="11" cy="12.5" r="1" fill={sel ? t.ink : t.muted} />
                <Circle cx="19" cy="12.5" r="1" fill={sel ? t.ink : t.muted} />
                <Path d={m.mouth} />
              </Svg>
              <T v="tiny" color={sel ? t.ink : t.muted}>{m.label}</T>
            </Pressable>
          );
        })}
      </Rise>

      <Rise delay={120}>
        <Card>
          <T v="small" muted style={{ fontWeight: "700" }}>Today's entry</T>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="Write freely. Only you can see this."
            placeholderTextColor={t.muted}
            accessibilityLabel="Today's entry"
            style={{ minHeight: 110, color: t.text, fontSize: 16, lineHeight: 23, textAlignVertical: "top" }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <T v="small" muted style={{ flex: 1 }}>Private · encrypted on our servers</T>
            <Button title="Save entry" onPress={save} busy={saving} disabled={!body.trim()} style={{ minHeight: 44, borderRadius: 12 }} />
          </View>
          {saveError ? <T color={t.bad}>{saveError}</T> : null}
        </Card>
      </Rise>

      <T v="h3">Past entries</T>
      <Field label="Search your entries" value={q} onChangeText={setQ} placeholder="landing page" autoCapitalize="none" />
      <ErrorBox error={error} onRetry={reload} />
      {data?.entries.length === 0 && <T muted>{q ? "No entries match that search." : "Your entries will show up here."}</T>}
      {data?.entries.map((e) => (
        <Card key={e.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T v="small" muted style={{ fontWeight: "700" }}>
              {new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {e.mood ? ` · ${MOODS.find((m) => m.key === e.mood)?.label}` : ""}
            </T>
            <Pressable onPress={() => remove(e)} accessibilityRole="button" accessibilityLabel="Delete entry" style={{ minHeight: 36, justifyContent: "center", paddingHorizontal: 6 }}>
              <T v="small" color={t.bad} style={{ fontWeight: "700" }}>Delete</T>
            </Pressable>
          </View>
          <T style={{ lineHeight: 22 }}>{e.body}</T>
        </Card>
      ))}
    </Screen>
  );
}
