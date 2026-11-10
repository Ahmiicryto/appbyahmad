import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, View } from "react-native";
import { ExerciseFigure } from "../../components/ExerciseFigure";
import { Icon } from "../../components/icons";
import { Button, Card, Glass, Header, Icon3D, Ring, Rise, Screen, T, Tap } from "../../components/ui";
import { api } from "../../lib/api";
import { useTheme } from "../../lib/AppContext";
import { blockSeconds, byId, doseLabel } from "../../lib/exercises";
import { back, swap } from "../../lib/nav";
import { getWorkout } from "../../lib/workoutStore";

// Keep the screen on during a workout (phones only; browsers handle this themselves).
const useScreenOn = Platform.OS === "web" ? () => {} : useKeepAwake;

const buzz = (kind = "light") => {
  if (Platform.OS === "web") return;
  (kind === "success" ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).catch(() => {});
};

export default function Workout() {
  const workout = useMemo(() => getWorkout(), []);
  const [phase, setPhase] = useState("overview"); // overview | active | done
  const [startedAt, setStartedAt] = useState(null);
  const [doneBlocks, setDoneBlocks] = useState([]);

  if (!workout?.blocks?.length) {
    return (
      <Screen>
        <Header title="Workout" />
        <Card><T>No workout selected.</T><Button small title="Back to Workout" onPress={() => swap("/fitness")} /></Card>
      </Screen>
    );
  }
  if (phase === "overview") return <Overview workout={workout} onStart={() => { setStartedAt(Date.now()); setPhase("active"); buzz(); }} />;
  if (phase === "active") {
    return <Player workout={workout} onFinish={(done) => { setDoneBlocks(done); setPhase("done"); buzz("success"); }} />;
  }
  return <Finished workout={workout} blocks={doneBlocks} seconds={Math.round((Date.now() - startedAt) / 1000)} />;
}

function Overview({ workout, onStart }) {
  const t = useTheme();
  const total = Math.round(workout.blocks.reduce((s, b) => s + blockSeconds(b), 0) / 60);
  return (
    <Screen footer={<View style={{ paddingHorizontal: 16, paddingBottom: 10 }}><Button title="Start workout" icon="play" onPress={onStart} /></View>}>
      <Header title="" />
      <Rise style={{ gap: 4 }}>
        <T v="h1">{workout.title}</T>
        <T v="small" muted>{workout.summary}</T>
        <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
          <Meta icon="timer" text={`~${total} min`} />
          <Meta icon="dumbbell" text={`${workout.blocks.length} moves`} />
          <Meta icon={workout.source === "ai" ? "sparkles" : "check"} text={workout.source === "ai" ? "Built by your coach" : "No equipment"} />
        </View>
      </Rise>
      {workout.blocks.map((b, i) => (
        <Rise key={i} delay={Math.min(i, 8) * 30}>
          <Glass radius={14} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 8 }}>
            <View style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: t.s2, alignItems: "center", justifyContent: "center" }}>
              <ExerciseFigure id={b.exercise_id} size={52} backdrop={false} playing={false} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="small" style={{ fontWeight: "700" }}>{byId[b.exercise_id]?.name}</T>
              <T v="tiny" muted>{doseLabel(b)}{b.rest_seconds ? ` · ${b.rest_seconds}s rest` : ""}</T>
            </View>
            <T v="tiny" muted>{i + 1}</T>
          </Glass>
        </Rise>
      ))}
    </Screen>
  );
}

function Player({ workout, onFinish }) {
  useScreenOn();
  const t = useTheme();
  const blocks = workout.blocks;
  const [index, setIndex] = useState(0);
  const [resting, setResting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [left, setLeft] = useState(blocks[0].seconds ?? 0);
  const done = useRef([]);
  const block = blocks[index];
  const next = blocks[index + 1];
  const ex = byId[block.exercise_id];
  const timed = resting || Boolean(block.seconds);
  const totalForPhase = resting ? block.rest_seconds : block.seconds ?? 0;

  // Advance: record the block, then rest (if any) or move to the next block.
  const advance = useRef(() => {});
  advance.current = (completed = true) => {
    if (!resting) {
      if (completed) done.current.push({ exercise_id: block.exercise_id, reps: block.reps ?? null, seconds: block.seconds ?? null });
      if (!next) return onFinish(done.current);
      if (block.rest_seconds > 0) {
        setResting(true);
        setLeft(block.rest_seconds);
        buzz();
        return;
      }
    }
    if (!next) return onFinish(done.current);
    setResting(false);
    setIndex((i) => i + 1);
    setLeft(next.seconds ?? 0);
    buzz();
  };

  // One ticking interval; the timer only runs for timed phases.
  useEffect(() => {
    if (!timed || paused) return undefined;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [timed, paused, index, resting]);
  useEffect(() => {
    if (timed && left === 0 && totalForPhase > 0) advance.current(true);
    else if (timed && left > 0 && left <= 3 && !paused) buzz();
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  function quit() {
    const leave = () => back();
    if (Platform.OS === "web") return window.confirm("End this workout? Progress won't be saved.") && leave();
    Alert.alert("End workout?", "Your progress won't be saved.", [{ text: "Keep going", style: "cancel" }, { text: "End", style: "destructive", onPress: leave }]);
  }

  const progress = ((index + (resting ? 1 : 0)) / blocks.length) * 100;
  return (
    <Screen scroll={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Tap onPress={quit} accessibilityRole="button" accessibilityLabel="End workout" hitSlop={8}>
          <Glass radius={12} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Icon name="x" color={t.text} size={18} /></Glass>
        </Tap>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.track, overflow: "hidden" }}>
          <View style={{ width: `${progress}%`, height: 6, borderRadius: 3, backgroundColor: t.acc }} />
        </View>
        <T v="small" muted style={{ fontWeight: "700" }}>{index + 1}/{blocks.length}</T>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
        {resting ? (
          <>
            <T v="tiny" muted style={{ letterSpacing: 1.4 }}>REST</T>
            <Ring size={190} stroke={10} continuous value={(left / Math.max(1, totalForPhase)) * 100} delay={0} label={`${left} seconds of rest`}>
              <T v="display" style={{ fontSize: 52 }}>{left}</T>
            </Ring>
            <T v="small" muted>Next up</T>
            <Glass radius={16} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 8, paddingRight: 14 }}>
              <ExerciseFigure id={next.exercise_id} size={56} backdrop={false} />
              <View>
                <T style={{ fontWeight: "700" }}>{byId[next.exercise_id]?.name}</T>
                <T v="tiny" muted>{doseLabel(next)}</T>
              </View>
            </Glass>
          </>
        ) : (
          <>
            <ExerciseFigure id={block.exercise_id} size={240} playing={!paused} />
            <T v="h1" style={{ textAlign: "center" }}>{ex?.name}</T>
            {block.seconds ? (
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                <T v="display" style={{ fontSize: 48 }}>{left}</T><T v="h3" muted>sec</T>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                <T v="display" style={{ fontSize: 48 }}>{block.reps}</T><T v="h3" muted>reps</T>
              </View>
            )}
            <T v="small" muted style={{ textAlign: "center", paddingHorizontal: 24 }}>{ex?.tips?.[0]}</T>
          </>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 10, paddingBottom: 8 }}>
        {timed ? (
          <Button style={{ flex: 1 }} variant="secondary" icon={paused ? "play" : "pause"} title={paused ? "Resume" : "Pause"} onPress={() => setPaused((p) => !p)} />
        ) : null}
        {resting ? (
          <Button style={{ flex: 1 }} icon="skip" title="Skip rest" onPress={() => advance.current(true)} />
        ) : block.seconds ? (
          <Button style={{ flex: 1 }} variant="secondary" icon="skip" title="Skip" onPress={() => advance.current(false)} />
        ) : (
          <>
            <Button style={{ flex: 0.6 }} variant="secondary" icon="skip" title="Skip" onPress={() => advance.current(false)} />
            <Button style={{ flex: 1 }} icon="check" title="Done" onPress={() => advance.current(true)} />
          </>
        )}
      </View>
    </Screen>
  );
}

function Finished({ workout, blocks, seconds }) {
  const t = useTheme();
  const [state, setState] = useState({ status: "saving" });
  const saved = useRef(false);

  async function save() {
    if (!blocks.length) return setState({ status: "empty" });
    setState({ status: "saving" });
    try {
      const r = await api("/fitness/logs", { method: "POST", body: { title: workout.title.slice(0, 80), duration_sec: Math.max(10, seconds), exercises: blocks } });
      setState({ status: "saved", log: r.log });
    } catch (error) {
      saved.current = false;
      setState({ status: "error", error });
    }
  }
  // Save exactly once, even if the screen re-renders.
  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    save();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
        <Rise style={{ alignItems: "center", gap: 10 }}>
          <Icon3D name="trophy" tone="amber" size={84} />
          <T v="display" style={{ textAlign: "center" }}>Workout complete</T>
          <T muted style={{ textAlign: "center" }}>{workout.title}</T>
        </Rise>
        <Rise delay={120} style={{ flexDirection: "row", gap: 8, alignSelf: "stretch" }}>
          <Tile label="Time" value={`${mins}:${String(secs).padStart(2, "0")}`} />
          <Tile label="Moves" value={blocks.length} />
          <Tile label="kcal" value={state.log?.calories ?? "–"} />
        </Rise>
        {state.status === "saving" && <T v="small" muted>Saving…</T>}
        {state.status === "saved" && <T v="small" color={t.good} style={{ fontWeight: "700" }}>Saved to your history. It counts toward your Life Score.</T>}
        {state.status === "empty" && <T v="small" muted>No moves were completed, so nothing was saved.</T>}
        {state.status === "error" && (
          <View style={{ alignItems: "center", gap: 8 }}>
            <T v="small" color={t.bad}>{state.error.message}</T>
            <Button small title="Try saving again" onPress={() => { saved.current = true; return save(); }} />
          </View>
        )}
      </View>
      <Button title="Done" onPress={() => swap("/fitness")} disabled={state.status === "saving"} />
    </Screen>
  );
}

function Tile({ label, value }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: t.s2 }}>
      <T v="h2">{value}</T>
      <T v="tiny" muted>{label}</T>
    </View>
  );
}

function Meta({ icon, text }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Icon name={icon} color={t.muted} size={14} />
      <T v="tiny" muted style={{ fontWeight: "600" }}>{text}</T>
    </View>
  );
}
