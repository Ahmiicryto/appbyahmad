import { useLocalSearchParams } from "expo-router";
import { back } from "../../lib/nav";
import { useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { TaskRow } from "../../components/TaskRow";
import { Bar, Button, Card, ErrorBox, Header, Loading, Overline, Rise, Screen, T, Tap } from "../../components/ui";
import { api } from "../../lib/api";
import { useTheme } from "../../lib/AppContext";
import { confirm } from "../../lib/confirm";
import { useLoad } from "../../lib/useLoad";
import { areaColor } from "../../theme/themes";

const NEXT = { upcoming: "in_progress", in_progress: "done", done: "upcoming" };
const LABEL = { upcoming: "Upcoming", in_progress: "In progress", done: "Done" };

export default function GoalDetail() {
  const { id } = useLocalSearchParams();
  const t = useTheme();
  const { data, error, loading, reload, setData } = useLoad(`/goals/${id}`);
  const [actionError, setActionError] = useState(null);

  if (loading && !data) return <Loading />;
  if (!data) return <Screen><ErrorBox error={error} onRetry={reload} /></Screen>;
  const { goal, milestones, tasks } = data;
  const color = areaColor(t, goal.category);

  async function run(fn) {
    setActionError(null);
    try {
      const r = await fn();
      if (r) setData(() => r);
    } catch (err) {
      setActionError(err.message);
    }
  }
  const patch = (body) => run(() => api(`/goals/${goal.id}`, { method: "PATCH", body }));
  const cycle = (m) => run(() => api(`/goals/${goal.id}/milestones/${m.id}`, { method: "PATCH", body: { status: NEXT[m.status] } }));
  const toggle = (task) => run(async () => {
    await api(`/tasks/${task.id}`, { method: "PATCH", body: { done: !task.done_at } });
    return api(`/goals/${goal.id}`);
  });
  async function remove() {
    if (!(await confirm("Delete this goal?", "Its milestones and tasks will be deleted too. This can't be undone.", "Delete goal"))) return;
    await api(`/goals/${goal.id}`, { method: "DELETE" });
    back();
  }

  return (
    <Screen>
      <Header title="Goal" />

      <Rise>
        <Card>
          <Overline color={color}>{goal.category}</Overline>
          <T v="h2">{goal.title}</T>
          {goal.target ? <T v="small" muted>Target: {goal.target}</T> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}><Bar value={goal.progress} color={color} height={10} /></View>
            <T v="h3">{goal.progress}%</T>
          </View>
          {goal.plan_summary ? <T muted style={{ lineHeight: 21 }}>{goal.plan_summary}</T> : null}
        </Card>
      </Rise>

      <Rise delay={100} style={{ gap: 4 }}>
        <T v="h3">Roadmap</T>
        <T v="small" muted>Tap a milestone to update it.</T>
      </Rise>
      <View>
        {milestones.map((m, i) => {
          const done = m.status === "done";
          const now = m.status === "in_progress";
          return (
            <Rise key={m.id} delay={150 + i * 60}>
              <Tap onPress={() => cycle(m)} accessibilityRole="button" accessibilityLabel={`${m.title}, ${LABEL[m.status]}`} style={{ flexDirection: "row", gap: 14, minHeight: 56 }}>
                <View style={{ alignItems: "center", width: 24 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: done || now ? t.acc : t.line, backgroundColor: done ? t.acc : now ? t.soft : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {done && <Svg width={12} height={12} viewBox="0 0 24 24"><Path d="M5 12l5 5L20 7" stroke={t.onAcc} strokeWidth={4} fill="none" strokeLinecap="round" /></Svg>}
                  </View>
                  {i < milestones.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: done ? t.acc : t.line }} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 14, gap: 2 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <T style={{ fontWeight: "800", flex: 1 }}>{m.title}</T>
                    <T v="small" color={m.status === "upcoming" ? t.muted : t.ink} style={{ fontWeight: "800" }}>{LABEL[m.status]}</T>
                  </View>
                  {m.due_date ? <T v="small" muted>By {new Date(`${m.due_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</T> : null}
                </View>
              </Tap>
            </Rise>
          );
        })}
      </View>

      <T v="h3">Tasks</T>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={{ ...task, goal_category: goal.category }} onToggle={toggle} />
      ))}

      {actionError ? <T color={t.bad} style={{ fontWeight: "700" }}>{actionError}</T> : null}
      <View style={{ gap: 10, marginTop: 8 }}>
        {goal.status === "active" ? (
          <>
            <Button title="Mark as completed" onPress={() => patch({ status: "completed" })} />
            <Button title="Pause this goal" variant="secondary" onPress={() => patch({ status: "paused" })} />
          </>
        ) : (
          <Button title="Make active again" onPress={() => patch({ status: "active" })} />
        )}
        <Button title="Delete goal" variant="danger" onPress={remove} />
      </View>
    </Screen>
  );
}
