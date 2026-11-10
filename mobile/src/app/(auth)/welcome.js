import { go } from "../../lib/nav";
import { Linking, View } from "react-native";
import { Icon } from "../../components/icons";
import { Button, Glass, IconTile, Logo, Ring, Rise, Screen, T } from "../../components/ui";
import { useTheme } from "../../lib/AppContext";
import { useAppConfig } from "../../lib/appConfig";

const POINTS = [
  ["calendar", "A daily plan built from your goals", "Every morning, the few things that matter most."],
  ["sparkles", "An AI coach that knows your week", "Ask anything. It plans, reflects and reviews with you."],
  ["lock", "Private by design", "Your journal and chats are encrypted."]
];

export default function Welcome() {
  const t = useTheme();
  const { config } = useAppConfig();
  return (
    <Screen>
      <Rise style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
        <Logo size={44} />
        <View>
          <T v="h3" style={{ fontSize: 18, letterSpacing: 2 }}>ELAUXI</T>
          <T v="small" muted>Your Everyday Superpower.</T>
        </View>
      </Rise>

      <Rise delay={80} style={{ alignItems: "center", paddingVertical: 18 }}>
        <Glass radius={120} strong style={{ padding: 14 }}>
          <Ring size={168} stroke={10} value={78} delay={350} label="Life Score preview: 782 of 1000">
            <T v="tiny" muted style={{ letterSpacing: 1.4 }}>LIFE SCORE</T>
            <T v="display" style={{ fontSize: 40, letterSpacing: -1 }}>782</T>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="trend" color={t.good} size={13} strokeWidth={2.2} />
              <T v="tiny" color={t.good}>+24 this week</T>
            </View>
          </Ring>
        </Glass>
      </Rise>

      <Rise delay={180} style={{ gap: 10 }}>
        <T v="display" style={{ lineHeight: 38 }}>Tell us the life you want. We'll help you build it.</T>
        <T muted style={{ lineHeight: 22 }}>Goals, money, fitness, career and your journal, connected in one calm daily plan.</T>
      </Rise>

      <Rise delay={260} style={{ gap: 14, marginTop: 4 }}>
        {POINTS.map(([icon, title, sub]) => (
          <View key={title} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <IconTile name={icon} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: "700" }}>{title}</T>
              <T v="small" muted>{sub}</T>
            </View>
          </View>
        ))}
      </Rise>

      <Rise delay={340} style={{ gap: 10, marginTop: 10 }}>
        {config.signupOpen !== false && <Button title="Create account" onPress={() => go("/sign-up")} />}
        <Button title="I already have an account" variant="secondary" onPress={() => go("/sign-in")} />
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
      <T v="small" color={t.ink} style={{ fontWeight: "700" }} onPress={() => Linking.openURL(url)} accessibilityRole="link">{label}</T>
    ) : (
      <T v="small" muted style={{ fontWeight: "700" }}>{label}</T>
    );
  return (
    <T v="small" muted style={{ textAlign: inline ? "left" : "center", lineHeight: 19 }}>
      {inline ? "I agree to the " : "By continuing you agree to our "}{link(termsUrl, "Terms")} and {link(privacyUrl, "Privacy Policy")}.
    </T>
  );
}
