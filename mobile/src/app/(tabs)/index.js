import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { AnnouncementBanner } from "../../components/AnnouncementBanner";
import { NotificationBell } from "../../components/NotificationBell";
import { TaskRow } from "../../components/TaskRow";
import { Avatar, Bar, Button, Card, Emoji, ErrorBox, Field, Loading, Ring, Rise, Screen, T } from "../../components/ui";
import { api } from "../../lib/api";
import { useApp, useTheme } from "../../lib/AppContext";
import { useLoad } from "../../lib/useLoad";
import { areaColor } from "../../theme/themes";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export default function Today() {
  const t = useTheme();
  const { profile } = useApp();
  const { data, error, loading, reload, setData } = useLoad("/today");
  const [newTask, setNewTask] = useState("");
  const score = useCountUp(data?.lifeScore.score ?? 0);

  if (loading && !data) return <Loading />;
  if (!data) return <Screen tabBar><ErrorBox error={error} onRetry={reload} /></Screen>;

  const date = new Date(`${data.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  async function toggle(task) {
    const done = !task.done_at;
    // Optimistic: tick instantly, roll back if the server says no.
    setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === task.id ? { ...x, done_at: done ? new Date().toISOString() : null } : x)), done: d.done + (done ? 1 : -1) }));
    try {
      await api(`/tasks/${task.id}`, { method: "PATCH", body: { done } });
      reload();
    } catch {
      reload();
    }
  }

  async function addTask() {
    const title = newTask.trim();
    if (!title) return;
    setNewTask("");
    await api("/tasks", { method: "POST", body: { title } }).catch(() => {});
    reload();
  }

  return (
    <Screen tabBar>
      <Rise style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.push("/profile")} accessibilityRole="button" accessibilityLabel="Open your profile" hitSlop={4}>
          <Avatar profile={profile} size={48} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <T v="h2" numberOfLines={1} style={{ fontSize: 19, flexShrink: 1 }}>{greeting()}{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}</T>
            <Emoji e="👋" size={19} anim="wave" delay={600} />
          </View>
          <T v="small" muted numberOfLines={1}>{date} · Here's your day.</T>
        </View>
        <NotificationBell />
      </Rise>

      <AnnouncementBanner />

      <Rise delay={80}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Ring size={108} value={data.lifeScore.score / 10} label={`Life Score ${data.lifeScore.score} of 1000`}>
            <T v="h1">{score}</T>
            <T v="tiny" muted>of 1000</T>
          </Ring>
          <View style={{ flex: 1, gap: 8 }}>
            <T v="h3">✨ Life Score</T>
            <Row label="Consistency" value={data.lifeScore.parts.consistency} color={t.ink} delay={300} />
            <Row label="Goals" value={data.lifeScore.parts.goals} color={t.c4} delay={400} />
            <T v="tiny" muted style={{ fontWeight: "500" }}>Progress and consistency over the last 7 days.</T>
          </View>
        </Card>
      </Rise>

      <Rise delay={150} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
        <T v="h3">🎯 Today's priorities</T>
        <T v="small" muted>{data.done} of {data.tasks.length} done</T>
      </Rise>

      {data.tasks.length ? (
        data.tasks.map((task, i) => (
          <Rise key={task.id} delay={200 + i * 50}>
            <TaskRow task={task} onToggle={toggle} />
          </Rise>
        ))
      ) : (
        <Rise delay={200}>
          <Card>
            <T v="h3">🌤️ Nothing planned for today</T>
            <T muted>{data.goals.length ? "Add a task below, or open a goal to see what's next." : "Set your first goal and we'll build your daily plan."}</T>
            {!data.goals.length && <Button title="Set my first goal" pulse onPress={() => router.push("/goal/new")} />}
          </Card>
        </Rise>
      )}

      <Rise delay={300} style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <Field style={{ flex: 1 }} label="Add a task for today" value={newTask} onChangeText={setNewTask} placeholder="Call the bank" onSubmitEditing={addTask} returnKeyType="done" />
        <Button title="Add" emoji="➕" small variant="secondary" onPress={addTask} disabled={!newTask.trim()} style={{ marginBottom: 4 }} />
      </Rise>

      {data.goals.length > 0 && (
        <Rise delay={350}>
          <Card>
            <T v="h3">🚀 Goal progress</T>
            {data.goals.map((g, i) => (
              <Pressable key={g.id} onPress={() => router.push(`/goal/${g.id}`)} accessibilityRole="link" style={{ gap: 6, paddingVertical: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <T v="small" style={{ fontWeight: "700", flex: 1 }} numberOfLines={1}>{g.title}</T>
                  <T v="small" muted>{g.progress}%</T>
                </View>
                <Bar value={g.progress} color={areaColor(t, g.category)} delay={400 + i * 80} />
              </Pressable>
            ))}
          </Card>
        </Rise>
      )}
    </Screen>
  );
}

function Row({ label, value, color, delay }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <T v="small" muted style={{ width: 86 }}>{label}</T>
      <View style={{ flex: 1 }}><Bar value={value} color={color} height={6} delay={delay} /></View>
      <T v="small" numberOfLines={1} style={{ width: 46, textAlign: "right", fontWeight: "700" }}>{value}%</T>
    </View>
  );
}

function useCountUp(target, ms = 1300) {
  const [v, setV] = useState(0);
  const raf = useRef();
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return v;
}
