import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Button, Card, Emoji, ErrorBox, Field, Glass, Header, Rise, Screen, T } from "../components/ui";
import { api } from "../lib/api";
import { useTheme } from "../lib/AppContext";
import { confirm } from "../lib/confirm";
import { useLoad } from "../lib/useLoad";

const MOODS = [
  { key: "happy", label: "Happy", e: "😄" },
  { key: "good", label: "Good", e: "🙂" },
  { key: "neutral", label: "Okay", e: "😐" },
  { key: "sad", label: "Low", e: "😔" },
  { key: "stressed", label: "Stressed", e: "😣" }
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
      <Header title="📓 Journal" />
      <Rise><T v="h2">How are you feeling today?</T></Rise>

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
              style={{ flex: 1, transform: [{ scale: sel ? 1.06 : 1 }] }}
            >
              <Glass radius={18} border={sel ? t.ink : undefined} style={{ alignItems: "center", gap: 4, paddingVertical: 10, borderWidth: 1.5, backgroundColor: sel ? t.soft : t.s1 }}>
                <Emoji key={sel ? "on" : "off"} e={m.e} size={28} anim={sel ? "bob" : undefined} />
                <T v="tiny" color={sel ? t.ink : t.muted} style={{ fontWeight: "800" }}>{m.label}</T>
              </Glass>
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
            <T v="small" muted style={{ flex: 1 }}>🔒 Private · encrypted</T>
            <Button title="Save entry" small onPress={save} busy={saving} disabled={!body.trim()} />
          </View>
          {saveError ? <T color={t.bad}>{saveError}</T> : null}
        </Card>
      </Rise>

      <T v="h3">Past entries</T>
      <Field label="Search your entries" emoji="🔍" value={q} onChangeText={setQ} placeholder="landing page" autoCapitalize="none" />
      <ErrorBox error={error} onRetry={reload} />
      {data?.entries.length === 0 && <T muted>{q ? "No entries match that search." : "Your entries will show up here."}</T>}
      {data?.entries.map((e) => (
        <Card key={e.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T v="small" muted style={{ fontWeight: "700" }}>
              {new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {e.mood ? ` · ${MOODS.find((m) => m.key === e.mood)?.e} ${MOODS.find((m) => m.key === e.mood)?.label}` : ""}
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
