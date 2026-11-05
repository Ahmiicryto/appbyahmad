import { View } from "react-native";
import { Card, Rise, Screen, T } from "../../components/ui";
import { useTheme } from "../../lib/AppContext";

const EXAMPLES = [
  "What should I focus on today?",
  "Am I on track with my savings goal?",
  "Change my workout, I only have 30 minutes.",
  "Can I afford this purchase this month?"
];

export default function Assistant() {
  const t = useTheme();
  return (
    <Screen tabBar>
      <Rise style={{ gap: 4 }}>
        <T v="h1">Assistant</T>
        <T v="small" muted>Knows your goals, money, fitness and schedule.</T>
      </Rise>
      <Rise delay={80}>
        <Card highlight={t.ink}>
          <T v="h3">✨ Coming in the next update</T>
          <T muted>Soon you'll be able to ask things like:</T>
          <View style={{ gap: 8 }}>
            {EXAMPLES.map((e) => (
              <View key={e} style={{ alignSelf: "flex-start", backgroundColor: t.soft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
                <T v="small">{e}</T>
              </View>
            ))}
          </View>
        </Card>
      </Rise>
    </Screen>
  );
}
