import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Card, Rise, Screen, T } from "../../components/ui";
import { useTheme } from "../../lib/AppContext";

export default function Life() {
  const t = useTheme();
  const areas = [
    { title: "Journal", sub: "Private place for your feelings", color: t.ink, href: "/journal" },
    { title: "Money", sub: "Income, spending, savings goals", color: t.c2 },
    { title: "Fitness", sub: "Your weekly workout plan", color: t.c3 },
    { title: "Nutrition", sub: "Calories, macros and meals", color: t.c3 },
    { title: "Career", sub: "Roadmap, résumé, job tracker", color: t.c4 },
    { title: "Future Me", sub: "The person you want to become", color: t.ink },
    { title: "Decisions", sub: "Compare options with your data", color: t.c4 }
  ];
  return (
    <Screen>
      <Rise style={{ gap: 4 }}>
        <T v="h1">Life</T>
        <T v="small" muted>Every area of your life, connected to your daily plan.</T>
      </Rise>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {areas.map((a, i) => (
          <Rise key={a.title} delay={60 + i * 50} style={{ width: "48%", flexGrow: 1 }}>
            <Pressable
              disabled={!a.href}
              onPress={() => router.push(a.href)}
              accessibilityRole={a.href ? "link" : "text"}
              accessibilityLabel={a.href ? a.title : `${a.title}, coming soon`}
            >
              <Card style={{ minHeight: 120, opacity: a.href ? 1 : 0.65 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: a.color }} />
                <T v="h3">{a.title}</T>
                <T v="small" muted>{a.sub}</T>
                {!a.href && <T v="tiny" muted>COMING NEXT</T>}
              </Card>
            </Pressable>
          </Rise>
        ))}
      </View>
    </Screen>
  );
}
