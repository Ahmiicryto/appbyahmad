import { View } from "react-native";
import { Card, ErrorBox, Loading, Ring, Rise, Screen, T } from "../../components/ui";
import { useTheme } from "../../lib/AppContext";
import { useLoad } from "../../lib/useLoad";
import { areaColor } from "../../theme/themes";

export default function Progress() {
  const t = useTheme();
  const { data, error, loading, reload } = useLoad("/today");
  if (loading && !data) return <Loading />;
  if (!data) return <Screen tabBar><ErrorBox error={error} onRetry={reload} /></Screen>;
  const { lifeScore, goals } = data;

  return (
    <Screen tabBar>
      <Rise style={{ gap: 4 }}>
        <T v="h1">Your progress</T>
        <T v="small" muted>Last 7 days</T>
      </Rise>
      <Rise delay={60}>
        <Card style={{ alignItems: "center", gap: 12 }}>
          <Ring size={160} stroke={14} value={lifeScore.score / 10} label={`Life Score ${lifeScore.score} of 1000`}>
            <T v="h1" style={{ fontSize: 36 }}>{lifeScore.score}</T>
            <T v="tiny" muted>LIFE SCORE</T>
          </Ring>
          <T v="small" muted style={{ textAlign: "center" }}>Measures progress and consistency only. It's not a judgement of you.</T>
        </Card>
      </Rise>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Rise delay={120} style={{ flex: 1 }}>
          <Card style={{ alignItems: "center" }}>
            <Ring size={80} stroke={8} value={lifeScore.parts.consistency} delay={300} label={`Consistency ${lifeScore.parts.consistency} percent`}>
              <T v="h3">{lifeScore.parts.consistency}%</T>
            </Ring>
            <T v="small" muted>🔥 Consistency</T>
          </Card>
        </Rise>
        <Rise delay={180} style={{ flex: 1 }}>
          <Card style={{ alignItems: "center" }}>
            <Ring size={80} stroke={8} value={lifeScore.parts.goals} color={t.c4} delay={400} label={`Goals ${lifeScore.parts.goals} percent`}>
              <T v="h3">{lifeScore.parts.goals}%</T>
            </Ring>
            <T v="small" muted>🎯 Goals</T>
          </Card>
        </Rise>
      </View>
      {goals.map((g, i) => (
        <Rise key={g.id} delay={240 + i * 60}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ring size={48} stroke={5} value={g.progress} color={areaColor(t, g.category)} delay={300 + i * 60} label={`${g.title} ${g.progress} percent`} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: "800" }}>{g.title}</T>
              <T v="small" muted>{g.progress}% complete</T>
            </View>
          </Card>
        </Rise>
      ))}
      <Card>
        <T v="h3">📊 Weekly Life Review</T>
        <T muted>Your weekly summary, patterns and "Build my next week" arrive in the next update.</T>
      </Card>
    </Screen>
  );
}
