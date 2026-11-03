import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Bar, Button, Card, ErrorBox, Loading, Rise, Screen, T } from "../../components/ui";
import { useTheme } from "../../lib/AppContext";
import { useLoad } from "../../lib/useLoad";
import { areaColor } from "../../theme/themes";

const STATUS = { active: "On track", paused: "Paused", completed: "Completed", cancelled: "Cancelled" };

export default function Goals() {
  const t = useTheme();
  const { data, error, loading, reload } = useLoad("/goals");
  if (loading && !data) return <Loading />;
  const goals = data?.goals ?? [];
  const active = goals.filter((g) => g.status === "active").length;

  return (
    <Screen>
      <Rise style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <T v="h1">Goals</T>
          <T v="small" muted>{active} active · {goals.length - active} other</T>
        </View>
        <Button title="+ New goal" onPress={() => router.push("/goal/new")} style={{ minHeight: 44, borderRadius: 14 }} />
      </Rise>
      <ErrorBox error={error} onRetry={reload} />
      {!goals.length && !error && (
        <Rise delay={100}>
          <Card>
            <T v="h3">What do you want to achieve?</T>
            <T muted>Lose 15 kg, save $20,000, start a business, read 20 books… Tell us and we'll turn it into a plan.</T>
            <Button title="Set my first goal" pulse onPress={() => router.push("/goal/new")} />
          </Card>
        </Rise>
      )}
      {goals.map((g, i) => {
        const color = areaColor(t, g.category);
        return (
          <Rise key={g.id} delay={80 + i * 60}>
            <Pressable onPress={() => router.push(`/goal/${g.id}`)} accessibilityRole="link" accessibilityLabel={`${g.title}, ${g.progress} percent`}>
              <Card style={{ opacity: g.status === "active" ? 1 : 0.7 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: t.soft }}>
                    <T v="tiny" color={color} style={{ textTransform: "capitalize" }}>{g.category}</T>
                  </View>
                  <T v="small" color={g.status === "active" ? t.ink : t.muted} style={{ fontWeight: "800" }}>{STATUS[g.status]}</T>
                </View>
                <T v="h2">{g.title}</T>
                {g.deadline ? <T v="small" muted>Target {new Date(`${g.deadline}T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</T> : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}><Bar value={g.progress} color={color} height={10} delay={200 + i * 60} /></View>
                  <T v="h3">{g.progress}%</T>
                </View>
                <T v="small" muted>{g.milestones_done} of {g.milestone_count} milestones done</T>
              </Card>
            </Pressable>
          </Rise>
        );
      })}
    </Screen>
  );
}
