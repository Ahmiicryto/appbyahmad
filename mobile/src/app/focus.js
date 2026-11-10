import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Button, Card, Field, Header, Icon3D, Ring, Rise, Screen, Segmented, T } from "../components/ui";
import { api } from "../lib/api";
import { useTheme } from "../lib/AppContext";

const MODES = { focus: { label: "Focus", minutes: 25, tone: "indigo" }, short: { label: "Short break", minutes: 5, tone: "green" }, long: { label: "Long break", minutes: 15, tone: "cyan" } };
const LENGTHS = [15, 25, 45, 60];
const useScreenOn = Platform.OS === "web" ? () => {} : useKeepAwake;
const buzz = () => Platform.OS !== "web" && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

// Pomodoro-style focus timer. A finished focus session is saved as a done task (counts toward the Life Score).
export default function Focus() {
  useScreenOn();
  const t = useTheme();
  const [mode, setMode] = useState("focus");
  const [length, setLength] = useState(25);
  const [label, setLabel] = useState("");
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [message, setMessage] = useState(null);
  const endAt = useRef(null);
  const total = (mode === "focus" ? length : MODES[mode].minutes) * 60;

  // Wall-clock based, so the timer stays right even if the app is in the background for a while.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setLeft(Math.max(0, Math.round((endAt.current - Date.now()) / 1000))), 500);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || left > 0) return;
    setRunning(false);
    buzz();
    if (mode === "focus") {
      const n = sessions + 1;
      setSessions(n);
      setMessage(`Session done. Take a ${n % 4 === 0 ? "long" : "short"} break.`);
      api("/tasks", { method: "POST", body: { title: `Focus: ${label.trim() || "Deep work"} (${length} min)` } })
        .then((task) => task?.task?.id && api(`/tasks/${task.task.id}`, { method: "PATCH", body: { done: true } }))
        .catch(() => {});
      switchMode(n % 4 === 0 ? "long" : "short");
    } else {
      setMessage("Break over. Ready for the next session?");
      switchMode("focus");
    }
  }, [left, running]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchMode(m, len = length) {
    setRunning(false);
    setMode(m);
    setLeft((m === "focus" ? len : MODES[m].minutes) * 60);
  }
  function toggle() {
    if (running) {
      setRunning(false);
      return;
    }
    setMessage(null);
    endAt.current = Date.now() + left * 1000;
    setRunning(true);
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <Screen>
      <Header title="Focus" />
      <Rise>
        <Segmented label="Timer mode" value={mode} onChange={(m) => switchMode(m)} options={Object.entries(MODES).map(([value, m]) => ({ value, label: m.label }))} />
      </Rise>
      <Rise delay={60} style={{ alignItems: "center", paddingVertical: 10, gap: 6 }}>
        <Ring size={240} stroke={12} continuous value={(left / total) * 100} delay={0} color={mode === "focus" ? t.ink : t.good} label={`${mm} minutes ${ss} seconds left`}>
          <T v="display" style={{ fontSize: 56, letterSpacing: -1 }}>{mm}:{ss}</T>
          <T v="small" muted>{MODES[mode].label}</T>
        </Ring>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i < sessions % 4 || (sessions > 0 && sessions % 4 === 0) ? t.acc : t.track }} />
          ))}
        </View>
        <T v="tiny" muted>{sessions} session{sessions === 1 ? "" : "s"} today</T>
      </Rise>
      {message ? <T v="small" color={t.good} style={{ textAlign: "center", fontWeight: "700" }}>{message}</T> : null}
      <Button title={running ? "Pause" : left < total ? "Resume" : "Start"} icon={running ? "pause" : "play"} onPress={toggle} />
      {!running && left < total ? <Button variant="secondary" small title="Reset" icon="refresh" onPress={() => switchMode(mode)} /> : null}
      {mode === "focus" && !running && left === total && (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon3D name="timer" tone="indigo" size={34} />
            <T v="h3">Session length</T>
          </View>
          <Segmented label="Session length" value={length} onChange={(v) => { setLength(v); setLeft(v * 60); }} options={LENGTHS.map((m) => ({ value: m, label: `${m}m` }))} />
          <Field icon="target" placeholder="What are you working on? (optional)" value={label} onChangeText={setLabel} maxLength={60} accessibilityLabel="What are you working on" />
        </Card>
      )}
    </Screen>
  );
}
