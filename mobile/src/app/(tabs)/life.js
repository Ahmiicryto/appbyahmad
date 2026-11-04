import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Card, Rise, Screen, T } from "../../components/ui";
import { useTheme } from "../../lib/AppContext";
import { useAppConfig } from "../../lib/appConfig";

// Screens that exist in the app today. An area is only tappable when it is switched on AND has a screen.
const ROUTES = { journal: "/journal" };

export default function Life() {
  const t = useTheme();
  const { config } = useAppConfig();
  const features = config.features ?? {};
  const areas = [
    { key: "journal", title: "Journal", sub: "Private place for your feelings", color: t.ink },
    { key: "money", title: "Money", sub: "Income, spending, savings goals", color: t.c2 },
    { key: "fitness", title: "Fitness", sub: "Your weekly workout plan", color: t.c3 },
    { key: "nutrition", title: "Nutrition", sub: "Calories, macros and meals", color: t.c3 },
    { key: "career", title: "Career", sub: "Roadmap, résumé, job tracker", color: t.c4 },
    { key: "future_me", title: "Future Me", sub: "The person you want to become", color: t.ink },
    { key: "decisions", title: "Decisions", sub: "Compare options with your data", color: t.c4 }
  ].map((a) => {
    const on = Boolean(features[a.key]);
    const href = on ? ROUTES[a.key] : undefined;
    return { ...a, href, tag: href ? null : on ? "AVAILABLE SOON" : "COMING NEXT" };
  });

  return (
    <Screen>
      <Rise style={{ gap: 4 }}>
        <T v="h1">Life</T>
        <T v="small" muted>Every area of your life, connected to your daily plan.</T>
      </Rise>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {areas.map((a, i) => (
          <Rise key={a.key} delay={60 + i * 50} style={{ width: "48%", flexGrow: 1 }}>
            <Pressable
              disabled={!a.href}
              onPress={() => router.push(a.href)}
              accessibilityRole={a.href ? "link" : "text"}
              accessibilityLabel={a.href ? a.title : `${a.title}, ${a.tag === "AVAILABLE SOON" ? "available soon" : "coming next"}`}
            >
              <Card style={{ minHeight: 120, opacity: a.href ? 1 : a.tag === "AVAILABLE SOON" ? 0.85 : 0.65 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: a.color }} />
                <T v="h3">{a.title}</T>
                <T v="small" muted>{a.sub}</T>
                {a.tag && <T v="tiny" color={a.tag === "AVAILABLE SOON" ? t.ink : undefined} muted={a.tag !== "AVAILABLE SOON"}>{a.tag}</T>}
              </Card>
            </Pressable>
          </Rise>
        ))}
      </View>
    </Screen>
  );
}
