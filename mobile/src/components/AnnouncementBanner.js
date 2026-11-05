import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "../lib/AppContext";
import { useAppConfig } from "../lib/appConfig";
import { Emoji, Glass, T } from "./ui";

// Admin-set banner. Dismissing hides this text until the admin posts a different one.
export function AnnouncementBanner({ style }) {
  const t = useTheme();
  const { config } = useAppConfig();
  const [dismissed, setDismissed] = useState(null);
  const a = config.announcement;
  if (!a?.text || dismissed === a.text) return null;

  const look = {
    info: { bg: t.soft, border: t.soft, text: t.ink },
    success: { bg: `${t.acc}26`, border: t.acc, text: t.text },
    warning: { bg: `${t.c2}24`, border: t.c2, text: t.text }
  }[a.level] ?? { bg: t.soft, border: t.soft, text: t.ink };

  return (
    <Glass
      radius={18}
      border={look.border}
      style={[{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: look.bg, paddingVertical: 8, paddingLeft: 12, paddingRight: 4 }, style]}
    >
      <Emoji e={{ info: "📣", success: "🎉", warning: "⚠️" }[a.level] ?? "📣"} size={17} anim="ring" />
      <T accessibilityRole="alert" v="small" color={look.text} style={{ flex: 1, fontWeight: "700" }}>{a.text}</T>
      <Pressable
        onPress={() => setDismissed(a.text)}
        accessibilityRole="button"
        accessibilityLabel="Dismiss announcement"
        hitSlop={8}
        style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
      >
        <T v="h2" color={look.text}>×</T>
      </Pressable>
    </Glass>
  );
}
