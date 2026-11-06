import { router } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "../lib/AppContext";
import { isAiOff, isUpgradeError } from "../lib/ai";
import { Icon } from "./icons";
import { Button, Glass, T } from "./ui";

// Frame for AI results: a subtle accent edge and a "Coach" label so AI content is always recognisable.
export function AiCard({ title, children, action, style }) {
  const t = useTheme();
  return (
    <Glass radius={22} border={t.pbd} style={[{ padding: 16, gap: 10 }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: t.acc, alignItems: "center", justifyContent: "center" }}>
          <Icon name="sparkles" color={t.onAcc} size={14} strokeWidth={2} />
        </View>
        <T v="small" style={{ fontWeight: "700", flex: 1 }}>{title}</T>
        {action}
      </View>
      {children}
    </Glass>
  );
}

export function AiThinking({ label = "Thinking…" }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
      <ActivityIndicator color={t.ink} size="small" />
      <T v="small" muted>{label}</T>
    </View>
  );
}

// Friendly error: upgrade prompt for the free limit, plain message otherwise.
export function AiError({ error }) {
  const t = useTheme();
  if (!error) return null;
  return (
    <View style={{ gap: 10 }}>
      <T v="small" color={isUpgradeError(error) || isAiOff(error) ? t.muted : t.bad} style={{ lineHeight: 19 }}>{error.message}</T>
      {isUpgradeError(error) && <Button small title="See Premium" icon="crown" onPress={() => router.push("/premium")} />}
    </View>
  );
}
