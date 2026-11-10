import { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { ExerciseFigure } from "../../components/ExerciseFigure";
import { Icon } from "../../components/icons";
import { Button, Card, Glass, Header, Icon3D, Rise, Screen, SectionTitle, Segmented, T, Tap } from "../../components/ui";
import { api } from "../../lib/api";
import { useTheme } from "../../lib/AppContext";
import { EXERCISES, FOCUSES, ROUTINES, byId } from "../../lib/exercises";
import { go } from "../../lib/nav";
import { useLoad } from "../../lib/useLoad";
import { setWorkout } from "../../lib/workoutStore";

const MINUTES = [10, 15, 20, 30];
const LEVELS = [{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }];

export default function Fitness() {
  const t = useTheme();
  const summary = useLoad("/fitness/summary");
  const logs = useLoad("/fitness/logs");
  const [minutes, setMinutes] = useState(15);
  const [focus, setFocus] = useState("full");
  const [level, setLevel] = useState("medium");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const s = summary.data;

  async function build(opts, key) {
    setBusy(key);
    setError(null);
    try {
      const w = await api("/ai/workout", { method: "POST", body: opts });
      setWorkout(w);
      go("/fitness/workout");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Header title="Workout" />

      <Rise>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Icon3D name="flame" tone="orange" size={46} />
            <View style={{ flex: 1 }}>
              <T v="h2">{s?.streak ?? 0} day streak</T>
              <T v="small" muted>{s?.streak ? "Keep it going today." : "Finish a workout to start your streak."}</T>
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {(s?.weekDays ?? Array.from({ length: 7 }, () => ({}))).map((d, i) => (
              <View key={i} style={{ alignItems: "center", gap: 5 }}>
                <T v="tiny" muted>{"MTWTFSS"[i]}</T>
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: d.done ? t.acc : t.s2, borderWidth: d.today ? 1.5 : 0, borderColor: t.ink }}>
                  {d.done ? <Icon name="check" color={t.onAcc} size={14} strokeWidth={2.6} /> : null}
                </View>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Stat label="Workouts" value={s?.week?.workouts ?? 0} />
            <Stat label="Minutes" value={s?.week?.minutes ?? 0} />
            <Stat label="kcal" value={s?.week?.calories ?? 0} />
          </View>
        </Card>
      </Rise>

      <Rise delay={60}>
        <SectionTitle title="Build my workout" />
        <Card style={{ marginTop: 8, gap: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {FOCUSES.map((f) => {
              const sel = f.id === focus;
              return (
                <Tap key={f.id} guard={200} onPress={() => setFocus(f.id)} accessibilityRole="radio" accessibilityState={{ checked: sel }} accessibilityLabel={f.label}>
                  <View style={{ width: 78, alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: sel ? t.ink : "transparent", backgroundColor: sel ? t.soft : t.s2 }}>
                    <Icon3D name={f.icon} tone={f.tone} size={36} />
                    <T v="tiny" style={{ fontWeight: "700" }} color={sel ? t.ink : t.text} numberOfLines={1}>{f.label}</T>
                  </View>
                </Tap>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {MINUTES.map((m) => (
              <Tap key={m} guard={200} onPress={() => setMinutes(m)} style={{ flex: 1 }} accessibilityRole="radio" accessibilityState={{ checked: m === minutes }}>
                <View style={{ height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: m === minutes ? t.acc : t.s2 }}>
                  <T v="small" color={m === minutes ? t.onAcc : t.text} style={{ fontWeight: "700" }}>{m} min</T>
                </View>
              </Tap>
            ))}
          </View>
          <Segmented label="Level" value={level} onChange={setLevel} options={LEVELS} />
          {error ? <T v="small" color={t.bad}>{error}</T> : null}
          <Button title="Create workout" icon="sparkles" busy={busy === "custom"} disabled={Boolean(busy)} onPress={() => build({ minutes, focus, level }, "custom")} />
        </Card>
      </Rise>

      <Rise delay={110}>
        <SectionTitle title="Quick routines" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8, paddingRight: 4 }}>
          {ROUTINES.map((r) => (
            <Tap key={r.key} onPress={() => !busy && build({ minutes: r.minutes, focus: r.focus, level: r.level }, r.key)} accessibilityRole="button" accessibilityLabel={`${r.title}, ${r.minutes} minutes`}>
              <Glass radius={18} style={{ width: 150, padding: 12, gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Icon3D name={r.icon} tone={r.tone} size={34} />
                  <T v="tiny" muted>{r.minutes} min</T>
                </View>
                <View style={{ alignItems: "center" }}><ExerciseFigure id={r.preview} size={96} playing={busy !== r.key} backdrop={false} /></View>
                <T v="small" style={{ fontWeight: "700" }} numberOfLines={1}>{busy === r.key ? "Preparing…" : r.title}</T>
                <T v="tiny" muted style={{ textTransform: "capitalize" }}>{r.level}</T>
              </Glass>
            </Tap>
          ))}
        </ScrollView>
      </Rise>

      <Rise delay={150}>
        <SectionTitle title="Exercise library" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {EXERCISES.map((e) => (
            <Tap key={e.id} onPress={() => setDetail(e.id)} style={{ width: "31.6%" }} accessibilityRole="button" accessibilityLabel={e.name}>
              <Glass radius={14} style={{ alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, gap: 2 }}>
                <ExerciseFigure id={e.id} size={78} backdrop={false} />
                <T v="tiny" style={{ fontWeight: "700", textAlign: "center" }} numberOfLines={1}>{e.name}</T>
              </Glass>
            </Tap>
          ))}
        </View>
      </Rise>

      {logs.data?.logs?.length ? (
        <Rise delay={190}>
          <SectionTitle title="History" />
          <Card style={{ marginTop: 8, gap: 0, paddingVertical: 6 }}>
            {logs.data.logs.slice(0, 10).map((l, i, arr) => (
              <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: i === arr.length - 1 ? 0 : 0.5, borderColor: t.line }}>
                <Icon3D name="trophy" tone="amber" size={32} />
                <View style={{ flex: 1 }}>
                  <T v="small" style={{ fontWeight: "700" }} numberOfLines={1}>{l.title}</T>
                  <T v="tiny" muted>{new Date(`${l.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {Math.round(l.duration_sec / 60)} min · {l.calories} kcal</T>
                </View>
              </View>
            ))}
          </Card>
        </Rise>
      ) : null}

      <Modal visible={Boolean(detail)} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <Tap guard={0} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setDetail(null)} accessibilityLabel="Close" />
        {detail && (
          <View style={{ position: "absolute", left: 10, right: 10, bottom: 18, borderRadius: 24, padding: 16, gap: 10, backgroundColor: t.solid, borderWidth: 1, borderColor: t.line }}>
            <View style={{ alignItems: "center" }}><ExerciseFigure id={detail} size={200} /></View>
            <T v="h2">{byId[detail].name}</T>
            <T v="small" muted style={{ textTransform: "capitalize" }}>{byId[detail].focus} · {byId[detail].seconds ? `${byId[detail].seconds} sec` : `${byId[detail].reps} reps`}</T>
            {byId[detail].tips.map((tip) => (
              <View key={tip} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <Icon name="check" color={t.good} size={15} strokeWidth={2.4} />
                <T v="small" style={{ flex: 1 }}>{tip}</T>
              </View>
            ))}
            <Button title="Close" variant="secondary" small onPress={() => setDetail(null)} />
          </View>
        )}
      </Modal>
    </Screen>
  );
}

function Stat({ label, value }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: t.s2 }}>
      <T v="h3">{value}</T>
      <T v="tiny" muted>{label}</T>
    </View>
  );
}
