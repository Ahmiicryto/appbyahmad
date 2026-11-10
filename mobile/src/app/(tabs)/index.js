import { go } from "../../lib/nav";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AiCard, AiError, AiThinking } from "../../components/AiCard";
import { AnnouncementBanner } from "../../components/AnnouncementBanner";
import { Icon } from "../../components/icons";
import { NotificationBell } from "../../components/NotificationBell";
import { TaskRow } from "../../components/TaskRow";
import { Avatar, Bar, Button, Card, Chevron, ErrorBox, Field, Glass, Icon3D, Loading, Ring, Rise, Screen, SectionTitle, T, Tap } from "../../components/ui";
import { planDay } from "../../lib/ai";
import { api } from "../../lib/api";
import { useApp, useTheme } from "../../lib/AppContext";
import { useAppConfig } from "../../lib/appConfig";
import { useLoad } from "../../lib/useLoad";
import { areaColor } from "../../theme/themes";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
const WHEN = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", anytime: "Anytime" };

export default function Today() {
  const t = useTheme();
  const { profile } = useApp();
  const { config } = useAppConfig();
  const { data, error, loading, reload, setData } = useLoad("/today");
  const [newTask, setNewTask] = useState("");
  const score = useCountUp(data?.lifeScore.score ?? 0);

  if (loading && !data) return <Loading />;
  if (!data) return <Screen tabBar><ErrorBox error={error} onRetry={reload} /></Screen>;

  const date = new Date(`${data.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  async function toggle(task) {
    const done = !task.done_at;
    // Optimistic: tick instantly, roll back if the server says no.
    setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === task.id ? { ...x, done_at: done ? new Date().toISOString() : null } : x)), done: d.done + (done ? 1 : -1) }));
    try {
      await api(`/tasks/${task.id}`, { method: "PATCH", body: { done } });
    } finally {
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
        <Tap onPress={() => go("/profile")} accessibilityRole="button" accessibilityLabel="Open your profile" hitSlop={4}>
          <Avatar profile={profile} size={46} />
        </Tap>
        <View style={{ flex: 1 }}>
          <T v="small" muted numberOfLines={1}>{date}</T>
          <T v="h2" numberOfLines={1} style={{ fontSize: 20 }}>{greeting()}{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}</T>
        </View>
        <NotificationBell />
      </Rise>

      <AnnouncementBanner />

      <Rise delay={60}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
          <Ring size={104} stroke={9} value={data.lifeScore.score / 10} label={`Life Score ${data.lifeScore.score} of 1000`}>
            <T v="h1" style={{ fontSize: 28 }}>{score}</T>
            <T v="tiny" muted>of 1000</T>
          </Ring>
          <View style={{ flex: 1, gap: 9 }}>
            <T v="tiny" muted style={{ letterSpacing: 1.2 }}>LIFE SCORE</T>
            <Row label="Consistency" value={data.lifeScore.parts.consistency} color={t.ink} delay={250} />
            <Row label="Goals" value={data.lifeScore.parts.goals} color={t.c4} delay={350} />
            <T v="tiny" muted style={{ fontWeight: "500", lineHeight: 15 }}>Last 7 days of progress and consistency.</T>
          </View>
        </Card>
      </Rise>

      <Rise delay={90} style={{ flexDirection: "row", gap: 8 }}>
        {[
          ["fitness", "/fitness", "dumbbell", "orange", "Workout"],
          ["habits", "/habits", "check", "violet", "Habits"],
          ["money", "/money", "wallet", "amber", "Money"],
          ["journal", "/journal", "book", "blue", "Journal"]
        ].filter(([k]) => config.features?.[k] !== false).map(([k, href, icon, tone, label]) => (
          <Tap key={k} onPress={() => go(href)} style={{ flex: 1 }} accessibilityRole="link" accessibilityLabel={label}>
            <Glass radius={16} style={{ alignItems: "center", gap: 6, paddingVertical: 10 }}>
              <Icon3D name={icon} tone={tone} size={34} />
              <T v="tiny" style={{ fontWeight: "700" }}>{label}</T>
            </Glass>
          </Tap>
        ))}
      </Rise>

      {config.features?.assistant !== false && (
        <Rise delay={110}>
          <PlanMyDay goalsCount={data.goals.length} onAdded={reload} />
        </Rise>
      )}

      <Rise delay={150}>
        <SectionTitle title="Today's priorities" />
        <T v="small" muted style={{ marginTop: 2 }}>{data.done} of {data.tasks.length} done</T>
      </Rise>

      {data.tasks.length ? (
        data.tasks.map((task, i) => (
          <Rise key={task.id} delay={180 + i * 40}>
            <TaskRow task={task} onToggle={toggle} />
          </Rise>
        ))
      ) : (
        <Rise delay={180}>
          <Card>
            <T v="h3">Nothing planned yet</T>
            <T muted style={{ lineHeight: 21 }}>{data.goals.length ? "Add a task below, or let the coach plan your day." : "Set your first goal and we'll build your daily plan around it."}</T>
            {!data.goals.length && <Button title="Set my first goal" icon="target" onPress={() => go("/goal/new")} />}
          </Card>
        </Rise>
      )}

      <Rise delay={240} style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <Field style={{ flex: 1 }} icon="plus" placeholder="Add a task for today" value={newTask} onChangeText={setNewTask} onSubmitEditing={addTask} returnKeyType="done" accessibilityLabel="Add a task for today" />
        <Button title="Add" small variant="secondary" onPress={addTask} disabled={!newTask.trim()} style={{ marginBottom: 6 }} />
      </Rise>

      {data.goals.length > 0 && (
        <Rise delay={280}>
          <SectionTitle title="Goals" action="See all" onAction={() => go("/goals")} />
          <Card style={{ marginTop: 8 }}>
            {data.goals.map((g, i) => (
              <Tap key={g.id} onPress={() => go(`/goal/${g.id}`)} accessibilityRole="link" style={{ gap: 6, paddingVertical: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <T v="small" style={{ fontWeight: "700", flex: 1 }} numberOfLines={1}>{g.title}</T>
                  <T v="small" muted>{g.progress}%</T>
                </View>
                <Bar value={g.progress} color={areaColor(t, g.category)} delay={300 + i * 60} height={6} />
              </Tap>
            ))}
          </Card>
        </Rise>
      )}
    </Screen>
  );
}

// AI suggestions for today; the user picks which ones to add.
function PlanMyDay({ goalsCount, onAdded }) {
  const t = useTheme();
  const [state, setState] = useState({ status: "idle" }); // idle | loading | ready | error
  const [picked, setPicked] = useState({});
  const [adding, setAdding] = useState(false);

  async function run() {
    setState({ status: "loading" });
    try {
      const r = await planDay();
      setState({ status: "ready", ...r });
      setPicked(Object.fromEntries(r.tasks.map((_, i) => [i, true])));
    } catch (error) {
      setState({ status: "error", error });
    }
  }

  async function add() {
    setAdding(true);
    const chosen = state.tasks.filter((_, i) => picked[i]);
    for (const task of chosen) {
      await api("/tasks", { method: "POST", body: { title: task.title, ...(task.goal_id ? { goal_id: task.goal_id } : { source: task.source }) } }).catch(() => {});
    }
    setAdding(false);
    setState({ status: "idle" });
    onAdded();
  }

  if (state.status === "idle") {
    return (
      <Tap onPress={run} accessibilityRole="button" accessibilityLabel="Plan my day with the AI coach">
        {({ pressed }) => (
          <AiCard title="Plan my day" style={{ opacity: pressed ? 0.9 : 1 }} action={<Chevron color={t.muted} dir="right" size={16} />}>
            <T v="small" muted style={{ lineHeight: 19 }}>
              {goalsCount ? "Get 3–5 focused tasks for today, based on your goals and how your week is going." : "Add a goal first, then the coach can plan your days around it."}
            </T>
          </AiCard>
        )}
      </Tap>
    );
  }

  return (
    <AiCard title="Your plan for today" action={state.status !== "loading" ? <Tap onPress={() => setState({ status: "idle" })} hitSlop={10} accessibilityLabel="Close plan"><Icon name="x" color={t.muted} size={16} /></Tap> : null}>
      {state.status === "loading" && <AiThinking label="Looking at your goals and week…" />}
      {state.status === "error" && <AiError error={state.error} />}
      {state.status === "ready" && (
        <>
          <T v="small" style={{ lineHeight: 20 }}>{state.summary}</T>
          <View style={{ gap: 8 }}>
            {state.tasks.map((task, i) => {
              const on = Boolean(picked[i]);
              return (
                <Tap key={i} onPress={() => setPicked((p) => ({ ...p, [i]: !on }))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={task.title}
                  style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 14, backgroundColor: on ? t.soft : t.s1, borderWidth: 1, borderColor: on ? t.pbd : t.line }}>
                  <View style={{ width: 20, height: 20, borderRadius: 6, marginTop: 1, borderWidth: 1.5, borderColor: on ? t.ink : t.muted, backgroundColor: on ? t.acc : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {on && <Icon name="check" color={t.onAcc} size={12} strokeWidth={3} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="small" style={{ fontWeight: "700" }}>{task.title}</T>
                    <T v="tiny" muted style={{ fontWeight: "500", lineHeight: 15 }}>{WHEN[task.time_of_day]} · {task.minutes} min · {task.why}</T>
                  </View>
                </Tap>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button small style={{ flex: 1 }} variant="secondary" title="Try again" icon="refresh" onPress={run} />
            <Button small style={{ flex: 1.4 }} title={`Add ${Object.values(picked).filter(Boolean).length} to today`} busy={adding} disabled={!Object.values(picked).some(Boolean)} onPress={add} />
          </View>
        </>
      )}
    </AiCard>
  );
}

function Row({ label, value, color, delay }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <T v="small" muted style={{ width: 84 }}>{label}</T>
      <View style={{ flex: 1 }}><Bar value={value} color={color} height={5} delay={delay} /></View>
      <T v="small" numberOfLines={1} style={{ width: 40, textAlign: "right", fontWeight: "700" }}>{value}%</T>
    </View>
  );
}

function useCountUp(target, ms = 1200) {
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
