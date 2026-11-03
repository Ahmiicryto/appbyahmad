import { router } from "expo-router";
import { View } from "react-native";
import { Button, Overline, Ring, Rise, Screen, T } from "../../components/ui";
import { useTheme } from "../../lib/AppContext";

export default function Welcome() {
  const t = useTheme();
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: "center", gap: 28 }}>
        <Rise style={{ alignItems: "center" }}>
          <Ring size={140} stroke={12} value={78} delay={300} label="Life Score preview">
            <T v="h1">782</T>
            <T v="tiny" muted>LIFE SCORE</T>
          </Ring>
        </Rise>
        <Rise delay={150} style={{ gap: 10 }}>
          <Overline>Your life. One plan. One app.</Overline>
          <T v="h1" style={{ fontSize: 34, lineHeight: 40 }}>Tell us the life you want. We'll help you build it.</T>
          <T muted style={{ lineHeight: 22 }}>
            Goals, money, fitness, career and your journal, connected in one daily plan that adapts when life changes.
          </T>
        </Rise>
      </View>
      <Rise delay={300} style={{ gap: 10 }}>
        <Button title="Create my account" pulse onPress={() => router.push({ pathname: "/sign-in", params: { mode: "register" } })} />
        <Button title="I already have an account" variant="secondary" onPress={() => router.push({ pathname: "/sign-in", params: { mode: "login" } })} />
        <T v="small" muted style={{ textAlign: "center", color: t.muted }}>Free to start. No card needed.</T>
      </Rise>
    </Screen>
  );
}
