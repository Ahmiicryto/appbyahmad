import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, Linking, View } from "react-native";
import { Button, Emoji, Glass, Pill, Ring, Rise, Screen, T } from "../../components/ui";
import { useTheme } from "../../lib/AppContext";
import { useAppConfig } from "../../lib/appConfig";

// Life areas orbiting the Life Score ring: [emoji, label, x, y] relative to the ring centre.
const BUBBLES = [
  ["🎯", "Goals", -128, -70],
  ["💰", "Money", 112, -84],
  ["💪", "Fitness", -138, 34],
  ["📓", "Journal", 122, 22],
  ["🚀", "Career", -84, 112],
  ["✨", "Future Me", 70, 118]
];

const POINTS = [
  ["🗓️", "A daily plan built from your goals"],
  ["🔄", "It adapts when you miss a day"],
  ["🔒", "Private and encrypted. Always."]
];

export default function Welcome() {
  const t = useTheme();
  const { config } = useAppConfig();
  return (
    <Screen>
      <Rise style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.acc, borderWidth: 1, borderColor: t.pbd, alignItems: "center", justifyContent: "center" }}>
          <T v="h3" color={t.onAcc}>A</T>
        </View>
        <T v="h3" style={{ flex: 1 }}>AppByAhmad</T>
        <Pill emoji="✨">Free to start</Pill>
      </Rise>

      <View style={{ height: 300, alignItems: "center", justifyContent: "center" }}>
        <Rise delay={100}>
          <Glass radius={90} strong style={{ padding: 10 }}>
            <Ring size={150} stroke={12} value={78} delay={400} label="Life Score preview: 782 of 1000">
              <T v="display">782</T>
              <T v="tiny" muted>LIFE SCORE</T>
            </Ring>
          </Glass>
        </Rise>
        {BUBBLES.map(([e, label, x, y], i) => (
          <Bubble key={label} e={e} label={label} x={x} y={y} delay={250 + i * 90} />
        ))}
      </View>

      <Rise delay={300} style={{ gap: 10 }}>
        <T v="display" style={{ lineHeight: 38 }}>Tell us the life you want. We'll help you build it.</T>
        <T muted style={{ lineHeight: 22 }}>Goals, money, fitness, career and your journal, connected in one daily plan.</T>
      </Rise>

      <Rise delay={380} style={{ gap: 8 }}>
        {POINTS.map(([e, text]) => (
          <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Glass radius={12} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}><T>{e}</T></Glass>
            <T style={{ fontWeight: "700", flex: 1 }}>{text}</T>
          </View>
        ))}
      </Rise>

      <Rise delay={460} style={{ gap: 10, marginTop: 6 }}>
        {config.signupOpen !== false && <Button title="Create my account" emoji="🚀" pulse onPress={() => router.push("/sign-up")} />}
        <Button title="I already have an account" variant="secondary" onPress={() => router.push("/sign-in")} />
        <Legal />
      </Rise>
    </Screen>
  );
}

export function Legal({ inline }) {
  const t = useTheme();
  const { config } = useAppConfig();
  const { termsUrl, privacyUrl } = config.legal || {};
  const link = (url, label) =>
    url ? (
      <T v="small" color={t.ink} style={{ fontWeight: "800" }} onPress={() => Linking.openURL(url)} accessibilityRole="link">{label}</T>
    ) : (
      <T v="small" muted style={{ fontWeight: "800" }}>{label}</T>
    );
  return (
    <T v="small" muted style={{ textAlign: inline ? "left" : "center", lineHeight: 19 }}>
      {inline ? "I agree to the " : "By continuing you agree to our "}{link(termsUrl, "Terms")} and {link(privacyUrl, "Privacy Policy")}.
    </T>
  );
}

function Bubble({ e, label, x, y, delay }) {
  const pop = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, delay, friction: 6, tension: 80, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200 + delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200 + delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pop, float, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        transform: [
          { translateX: x },
          { translateY: Animated.add(y, float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] })) },
          { scale: pop }
        ],
        opacity: pop
      }}
    >
      <Glass radius={999} strong style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7 }}>
        <Emoji e={e} size={16} />
        <T v="small" style={{ fontWeight: "800" }}>{label}</T>
      </Glass>
    </Animated.View>
  );
}
