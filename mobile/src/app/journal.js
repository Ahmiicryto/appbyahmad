import { useState } from "react";
import { TextInput, View } from "react-native";
import { AiCard, AiError, AiThinking } from "../components/AiCard";
import { Icon, MoodFace } from "../components/icons";
import { Button, Card, ErrorBox, Field, Glass, Header, Rise, Screen, SectionTitle, T, Tap } from "../components/ui";
import { reflectOn } from "../lib/ai";
import { api } from "../lib/api";
import { useTheme } from "../lib/AppContext";
import { useAppConfig } from "../lib/appConfig";
import { confirm } from "../lib/confirm";
import { useLoad } from "../lib/useLoad";

const MOODS = [
  { key: "happy", label: "Great" },
  { key: "good", label: "Good" },
  { key: "neutral", label: "Okay" },
  { key: "sad", label: "Low" },
  { key: "stressed", label: "Stressed" }
];
const moodLabel = (k) => MOODS.find((m) => m.key === k)?.label;

export default function Journal() {
  const t = useTheme();
  const { config } = useAppConfig();
  const [mood, setMood] = useState(null);
  const [body, setBody] = useState("");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const { data, error, reload, setData } = useLoad(`/journal${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  const aiOn = config.features?.assistant !== false;

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

  const setReflection = (id, reflection) =>
    setData((d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? { ...e, reflection } : e)) }));

  return (
    <Screen>
      <Header title="Journal" />
      <Rise><T v="h3" style={{ fontSize: 18 }}>How are you feeling today?</T></Rise>

      <Rise delay={50} style={{ flexDirection: "row", gap: 6 }} accessibilityRole="radiogroup">
        {MOODS.map((m) => {
          const sel = mood === m.key;
          return (
            <Tap key={m.key} onPress={() => setMood(sel ? null : m.key)} accessibilityRole="radio" accessibilityState={{ checked: sel }} accessibilityLabel={m.label} style={{ flex: 1 }}>
              <Glass radius={16} border={sel ? t.ink : undefined} style={{ alignItems: "center", gap: 6, paddingVertical: 12, borderWidth: sel ? 1.5 : 1, backgroundColor: sel ? t.soft : t.s1 }}>
                <MoodFace mood={m.key} color={sel ? t.ink : t.muted} size={26} />
                <T v="tiny" color={sel ? t.ink : t.muted} style={{ fontWeight: "700" }}>{m.label}</T>
              </Glass>
            </Tap>
          );
        })}
      </Rise>

      <Rise delay={100}>
        <Card>
          <T v="small" muted style={{ fontWeight: "700" }}>Today's entry</T>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="Write freely. Only you can see this."
            placeholderTextColor={t.muted}
            accessibilityLabel="Today's entry"
            style={{ minHeight: 120, color: t.text, fontSize: 16, lineHeight: 24, textAlignVertical: "top" }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <Icon name="lock" color={t.muted} size={13} />
              <T v="small" muted>Private · encrypted</T>
            </View>
            <Button title="Save entry" small onPress={save} busy={saving} disabled={!body.trim()} />
          </View>
          {saveError ? <T color={t.bad}>{saveError}</T> : null}
        </Card>
      </Rise>

      <SectionTitle title="Past entries" />
      <Field icon="search" placeholder="Search your entries" value={q} onChangeText={setQ} autoCapitalize="none" accessibilityLabel="Search your entries" />
      <ErrorBox error={error} onRetry={reload} />
      {data?.entries.length === 0 && <T muted>{q ? "No entries match that search." : "Your entries will show up here."}</T>}
      {data?.entries.map((e) => (
        <Card key={e.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              {e.mood ? <MoodFace mood={e.mood} color={t.ink} size={18} /> : null}
              <T v="small" muted style={{ fontWeight: "700" }}>
                {new Date(e.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                {e.mood ? ` · ${moodLabel(e.mood)}` : ""}
              </T>
            </View>
            <Tap onPress={() => remove(e)} accessibilityRole="button" accessibilityLabel="Delete entry" hitSlop={8}>
              <Icon name="trash" color={t.muted} size={17} />
            </Tap>
          </View>
          <T style={{ lineHeight: 23 }}>{e.body}</T>
          {aiOn && <Reflection entry={e} onDone={(r) => setReflection(e.id, r)} />}
        </Card>
      ))}
    </Screen>
  );
}

function Reflection({ entry, onDone }) {
  const t = useTheme();
  const [state, setState] = useState({ status: "idle" });

  async function run() {
    setState({ status: "loading" });
    try {
      const r = await reflectOn(entry.id);
      onDone({ reflection: r.reflection, themes: r.themes, suggestion: r.suggestion });
      setState({ status: "idle" });
    } catch (error) {
      setState({ status: "error", error });
    }
  }

  const r = entry.reflection;
  if (r) {
    return (
      <AiCard title="Coach reflection" style={{ marginTop: 2 }}>
        <T v="small" style={{ lineHeight: 20 }}>{r.reflection}</T>
        {r.themes?.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {r.themes.map((th) => (
              <View key={th} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: t.soft }}>
                <T v="tiny" color={t.ink}>{th}</T>
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <Icon name="sunrise" color={t.ink} size={16} />
          <T v="small" style={{ flex: 1, lineHeight: 20, fontWeight: "600" }}>{r.suggestion}</T>
        </View>
      </AiCard>
    );
  }
  if (state.status === "loading") return <AiThinking label="Reading your entry…" />;
  if (state.status === "error") return <AiError error={state.error} />;
  return (
    <Tap onPress={run} accessibilityRole="button" hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 }}>
      <Icon name="sparkles" color={t.ink} size={15} />
      <T v="small" color={t.ink} style={{ fontWeight: "700" }}>Reflect with coach</T>
    </Tap>
  );
}
