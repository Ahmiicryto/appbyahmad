import { useState } from "react";
import { Modal, TextInput, View } from "react-native";
import { Icon } from "../components/icons";
import { Button, Card, ErrorBox, Field, Header, Icon3D, IconButton, Loading, Rise, Screen, SectionTitle, T, Tap } from "../components/ui";
import { api } from "../lib/api";
import { useTheme } from "../lib/AppContext";
import { confirm } from "../lib/confirm";
import { useLoad } from "../lib/useLoad";

const PRESETS = [
  { label: "1 month", days: 30 },
  { label: "6 months", days: 182 },
  { label: "1 year", days: 365 },
  { label: "3 years", days: 1095 }
];
const PROMPTS = [
  "What are you proud of right now?",
  "What do you hope has changed by then?",
  "What advice would you give your future self?",
  "What are you worried about that probably won't matter?"
];
const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const nice = (ymd) => new Date(`${ymd}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
const daysUntil = (ymd, today) => Math.round((new Date(`${ymd}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 864e5);

// Letters to your future self, sealed until the date you choose.
export default function Future() {
  const t = useTheme();
  const { data, error, loading, reload, setData } = useLoad("/future");
  const [writing, setWriting] = useState(false);
  const [reading, setReading] = useState(null);

  if (loading && !data) return <Loading />;
  const letters = data?.letters ?? [];
  const sealed = letters.filter((l) => !l.unlocked);
  const ready = letters.filter((l) => l.unlocked);

  async function open(l) {
    try {
      const r = await api(`/future/${l.id}/open`, { method: "POST" });
      setReading(r.letter);
      reload();
    } catch (err) {
      setReading({ title: l.title, body: err.message, unlock_on: l.unlock_on });
    }
  }
  async function remove(l) {
    if (!(await confirm("Delete this letter?", "It will be gone for good.", "Delete"))) return;
    await api(`/future/${l.id}`, { method: "DELETE" }).catch(() => {});
    setReading(null);
    reload();
  }

  return (
    <Screen footer={<View style={{ paddingHorizontal: 16, paddingBottom: 10 }}><Button title="Write to future me" icon="pencil" onPress={() => setWriting(true)} /></View>}>
      <Header title="Future Me" />
      <ErrorBox error={error} onRetry={reload} />
      <Rise>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon3D name="sparkles" tone="cyan" size={46} />
          <View style={{ flex: 1 }}>
            <T v="h3">Talk to the person you're becoming</T>
            <T v="tiny" muted style={{ fontWeight: "500" }}>Write a letter today. It stays sealed until the date you pick.</T>
          </View>
        </Card>
      </Rise>

      {ready.length > 0 && <SectionTitle title="Ready to open" />}
      {ready.map((l) => (
        <Tap key={l.id} onPress={() => open(l)} accessibilityRole="button" accessibilityLabel={`Open ${l.title}`}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Icon3D name={l.opened_at ? "mail" : "gift"} tone={l.opened_at ? "slate" : "amber"} size={38} />
            <View style={{ flex: 1 }}>
              <T v="small" style={{ fontWeight: "700" }}>{l.title}</T>
              <T v="tiny" muted>{l.opened_at ? "Opened" : "New! Tap to open"} · written {new Date(l.created_at).toLocaleDateString()}</T>
            </View>
          </Card>
        </Tap>
      ))}

      {sealed.length > 0 && <SectionTitle title="Sealed" />}
      {sealed.map((l) => (
        <Card key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon3D name="lock" tone="indigo" size={38} />
          <View style={{ flex: 1 }}>
            <T v="small" style={{ fontWeight: "700" }}>{l.title}</T>
            <T v="tiny" muted>Opens {nice(l.unlock_on)} · in {daysUntil(l.unlock_on, data.today)} days</T>
          </View>
          <IconButton label={`Delete ${l.title}`} size={34} onPress={() => remove(l)}><Icon name="trash" color={t.muted} size={15} /></IconButton>
        </Card>
      ))}

      {!letters.length && !error && <T v="small" muted style={{ textAlign: "center", marginTop: 8 }}>No letters yet. Your first one takes two minutes.</T>}

      <WriteSheet open={writing} today={data?.today} onClose={() => setWriting(false)} onSaved={(r) => { setData(() => r); setWriting(false); }} />

      <Modal visible={Boolean(reading)} transparent animationType="fade" onRequestClose={() => setReading(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 18 }}>
          {reading && (
            <View style={{ borderRadius: 24, padding: 18, gap: 12, backgroundColor: t.solid, borderWidth: 1, borderColor: t.line, maxHeight: "85%" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon3D name="mail" tone="amber" size={38} />
                <View style={{ flex: 1 }}>
                  <T v="h2">{reading.title}</T>
                  {reading.created_at ? <T v="tiny" muted>From you, {new Date(reading.created_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</T> : null}
                </View>
              </View>
              <T style={{ lineHeight: 24 }}>{reading.body}</T>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {reading.id ? <Button style={{ flex: 1 }} small variant="secondary" icon="trash" title="Delete" onPress={() => remove(reading)} /> : null}
                <Button style={{ flex: 1.4 }} small title="Close" onPress={() => setReading(null)} />
              </View>
            </View>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

function WriteSheet({ open, today, onClose, onSaved }) {
  const t = useTheme();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [days, setDays] = useState(365);
  const [error, setError] = useState(null);
  const unlock = today ? addDays(today, days) : null;

  async function save() {
    setError(null);
    try {
      const r = await api("/future", { method: "POST", body: { title: title.trim() || `Letter to ${nice(unlock)}`, body: body.trim(), unlock_on: unlock } });
      setTitle("");
      setBody("");
      onSaved(r);
    } catch (err) {
      setError(err.fields ? Object.values(err.fields).flat()[0] : err.message);
    }
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Tap guard={0} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ position: "absolute", left: 10, right: 10, bottom: 18, borderRadius: 24, padding: 16, gap: 10, backgroundColor: t.solid, borderWidth: 1, borderColor: t.line }}>
        <T v="h2">Dear future me…</T>
        <Field placeholder="Title (optional)" value={title} onChangeText={setTitle} maxLength={80} accessibilityLabel="Letter title" />
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          placeholder={PROMPTS[new Date().getDate() % PROMPTS.length]}
          placeholderTextColor={t.muted}
          accessibilityLabel="Letter"
          style={{ minHeight: 130, maxHeight: 220, color: t.text, fontSize: 15, lineHeight: 22, textAlignVertical: "top", padding: 12, borderRadius: 14, backgroundColor: t.s2 }}
        />
        <T v="small" muted style={{ fontWeight: "600" }}>Open on {unlock ? nice(unlock) : "…"}</T>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {PRESETS.map((p) => (
            <Tap key={p.days} guard={150} onPress={() => setDays(p.days)} style={{ flex: 1 }} accessibilityRole="radio" accessibilityState={{ checked: days === p.days }}>
              <View style={{ height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: days === p.days ? t.acc : t.s2 }}>
                <T v="tiny" color={days === p.days ? t.onAcc : t.text} style={{ fontWeight: "700" }}>{p.label}</T>
              </View>
            </Tap>
          ))}
        </View>
        {error ? <T v="small" color={t.bad}>{error}</T> : null}
        <Button title="Seal letter" icon="lock" disabled={!body.trim() || !unlock} onPress={save} />
      </View>
    </Modal>
  );
}
