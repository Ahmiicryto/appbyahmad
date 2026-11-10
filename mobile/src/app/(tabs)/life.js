import { View } from "react-native";
import { Icon } from "../../components/icons";
import { Card, Chevron, Icon3D, Rise, Screen, SectionTitle, T, Tap } from "../../components/ui";
import { useTheme } from "../../lib/AppContext";
import { useAppConfig } from "../../lib/appConfig";
import { go } from "../../lib/nav";

// Areas with a screen today. Missing feature keys count as on (older saved settings).
const LIVE = [
  { key: "fitness", icon: "dumbbell", tone: "orange", title: "Workout", sub: "Guided home workouts", href: "/fitness" },
  { key: "habits", icon: "check", tone: "violet", title: "Habits", sub: "Daily streaks", href: "/habits" },
  { key: "money", icon: "wallet", tone: "amber", title: "Money", sub: "Spending & budget", href: "/money" },
  { key: "journal", icon: "book", tone: "blue", title: "Journal", sub: "Private reflections", href: "/journal" },
  { key: "assistant", icon: "sparkles", tone: "indigo", title: "Coach", sub: "Ask your AI coach", href: "/assistant" }
];
const SOON = [
  { key: "nutrition", icon: "leaf", tone: "lime", title: "Nutrition" },
  { key: "career", icon: "briefcase", tone: "pink", title: "Career" },
  { key: "future_me", icon: "sparkles", tone: "cyan", title: "Future Me" },
  { key: "decisions", icon: "scale", tone: "slate", title: "Decisions" }
];

export default function Life() {
  const t = useTheme();
  const { config } = useAppConfig();
  const features = config.features ?? {};
  const live = LIVE.filter((a) => features[a.key] !== false);

  return (
    <Screen tabBar>
      <Rise style={{ gap: 2 }}>
        <T v="h1">Life</T>
        <T v="small" muted>Every area of your life, connected to your daily plan.</T>
      </Rise>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {live.map((a, i) => (
          <Rise key={a.key} delay={40 + i * 40} style={{ width: "48%", flexGrow: 1 }}>
            <Tap onPress={() => go(a.href)} accessibilityRole="link" accessibilityLabel={a.title}>
              <Card style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Icon3D name={a.icon} tone={a.tone} size={42} />
                  <Chevron color={t.muted} dir="right" size={16} />
                </View>
                <View>
                  <T v="h3">{a.title}</T>
                  <T v="tiny" muted style={{ fontWeight: "500" }}>{a.sub}</T>
                </View>
              </Card>
            </Tap>
          </Rise>
        ))}
      </View>

      <Rise delay={260}>
        <SectionTitle title="Coming soon" />
        <Card style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
          {SOON.map((a) => (
            <View key={a.key} style={{ alignItems: "center", gap: 6, flex: 1, opacity: 0.7 }}>
              <Icon3D name={a.icon} tone={a.tone} size={36} />
              <T v="tiny" muted style={{ fontWeight: "600" }}>{a.title}</T>
            </View>
          ))}
        </Card>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 8 }}>
          <Icon name="info" color={t.muted} size={13} />
          <T v="tiny" muted style={{ fontWeight: "500" }}>New areas arrive in free updates.</T>
        </View>
      </Rise>
    </Screen>
  );
}
