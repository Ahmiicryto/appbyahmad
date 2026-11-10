import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { AiCard, AiError, AiThinking } from "../../components/AiCard";
import { Icon } from "../../components/icons";
import { Button, Card, ErrorBox, Loading, Ring, Rise, Screen, SectionTitle, T, Tap } from "../../components/ui";
import { getWeeklyReview, makeWeeklyReview } from "../../lib/ai";
import { useTheme } from "../../lib/AppContext";
import { useAppConfig } from "../../lib/appConfig";
import { useLoad } from "../../lib/useLoad";
import { areaColor } from "../../theme/themes";

export default function Progress() {
  const t = useTheme();
  const { config } = useAppConfig();
  const { data, error, loading, reload } = useLoad("/today");
  if (loading && !data) return <Loading />;
  if (!data) return <Screen tabBar><ErrorBox error={error} onRetry={reload} /></Screen>;
  const { lifeScore, goals } = data;

  return (
    <Screen tabBar>
      <Rise style={{ gap: 2 }}>
        <T v="h1">Progress</T>
        <T v="small" muted>Last 7 days</T>
      </Rise>

      <Rise delay={50}>
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 22 }}>
          <Ring size={168} stroke={12} value={lifeScore.score / 10} label={`Life Score ${lifeScore.score} of 1000`}>
            <T v="tiny" muted style={{ letterSpacing: 1.4 }}>LIFE SCORE</T>
            <T v="display" style={{ fontSize: 40, letterSpacing: -1 }}>{lifeScore.score}</T>
          </Ring>
          <T v="small" muted style={{ textAlign: "center", maxWidth: 280, lineHeight: 19 }}>Measures progress and consistency only. It's never a judgement of you.</T>
        </Card>
      </Rise>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Rise delay={100} style={{ flex: 1 }}>
          <Stat icon="flame" label="Consistency" value={lifeScore.parts.consistency} color={t.ink} />
        </Rise>
        <Rise delay={140} style={{ flex: 1 }}>
          <Stat icon="target" label="Goal progress" value={lifeScore.parts.goals} color={t.c4} />
        </Rise>
      </View>

      {config.features?.assistant !== false && (
        <Rise delay={180}>
          <WeeklyReview />
        </Rise>
      )}

      {goals.length > 0 && <SectionTitle title="Goals" />}
      {goals.map((g, i) => (
        <Rise key={g.id} delay={220 + i * 50}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Ring size={46} stroke={5} value={g.progress} color={areaColor(t, g.category)} delay={300 + i * 50} label={`${g.title} ${g.progress} percent`} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: "700" }} numberOfLines={1}>{g.title}</T>
              <T v="small" muted>{g.progress}% complete</T>
            </View>
          </Card>
        </Rise>
      ))}
    </Screen>
  );
}

function Stat({ icon, label, value, color }) {
  const t = useTheme();
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={icon} color={color} size={16} />
        <T v="small" muted style={{ fontWeight: "600" }}>{label}</T>
      </View>
      <T v="h1" style={{ fontSize: 28 }}>{value}<T v="h3" muted>%</T></T>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: t.track, overflow: "hidden" }}>
        <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: 5, borderRadius: 3, backgroundColor: color }} />
      </View>
    </Card>
  );
}

function WeeklyReview() {
  const t = useTheme();
  const [state, setState] = useState({ status: "loading" });

  useFocusEffect(useCallback(() => {
    let alive = true;
    getWeeklyReview()
      .then((r) => alive && setState({ status: r.review ? "ready" : "empty", review: r.review }))
      .catch(() => alive && setState({ status: "empty" }));
    return () => { alive = false; };
  }, []));

  async function generate() {
    setState({ status: "generating" });
    try {
      const r = await makeWeeklyReview();
      setState({ status: "ready", review: r.review });
    } catch (error) {
      setState({ status: "error", error });
    }
  }

  const r = state.review;
  return (
    <AiCard
      title="Weekly review"
      action={state.status === "ready" ? (
        <Tap onPress={generate} hitSlop={10} accessibilityRole="button" accessibilityLabel="Refresh weekly review"><Icon name="refresh" color={t.muted} size={16} /></Tap>
      ) : null}
    >
      {state.status === "loading" && <AiThinking label="Loading…" />}
      {state.status === "generating" && <AiThinking label="Reviewing your week…" />}
      {state.status === "error" && <AiError error={state.error} />}
      {state.status === "empty" && (
        <>
          <T v="small" muted style={{ lineHeight: 19 }}>Your coach looks at your tasks, goals and moods from the last 7 days and tells you what worked, what slipped and what to focus on next.</T>
          <Button small title="Write my weekly review" icon="sparkles" onPress={generate} />
        </>
      )}
      {state.status === "ready" && r && (
        <View style={{ gap: 12 }}>
          <T style={{ fontWeight: "700", lineHeight: 22 }}>{r.headline}</T>
          <List title="What went well" icon="check" items={r.wins} color={t.good} />
          <List title="Patterns" icon="trend" items={r.patterns} color={t.c2} />
          <List title="Focus next week" icon="target" items={r.next_week} color={t.ink} />
        </View>
      )}
    </AiCard>
  );
}

function List({ title, icon, items, color }) {
  if (!items?.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={icon} color={color} size={14} strokeWidth={2.2} />
        <T v="tiny" muted style={{ letterSpacing: 1, textTransform: "uppercase" }}>{title}</T>
      </View>
      {items.map((x, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          <T v="small" muted>•</T>
          <T v="small" style={{ flex: 1, lineHeight: 20 }}>{x}</T>
        </View>
      ))}
    </View>
  );
}
