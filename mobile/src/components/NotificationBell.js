import { useFocusEffect } from "expo-router";
import { go } from "../lib/nav";
import { useCallback, useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { api } from "../lib/api";
import { useTheme } from "../lib/AppContext";
import { Glass, T, Tap } from "./ui";

export const BellIcon = ({ color, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Svg>
);

// Bell with an unread badge. Refreshes the count whenever the screen comes into focus.
export function NotificationBell() {
  const t = useTheme();
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api("/notifications/unread-count")
        .then((r) => active && setCount(r?.count ?? 0))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [])
  );

  const label = count ? `Notifications, ${count} unread` : "Notifications";
  return (
    <Tap
      onPress={() => go("/notifications")}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <Glass radius={14} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <BellIcon color={t.text} />
      </Glass>
      {count > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
            backgroundColor: t.acc, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: t.bg
          }}
        >
          <T v="tiny" color={t.onAcc} style={{ fontSize: 10, lineHeight: 12 }}>{count > 99 ? "99+" : count}</T>
        </View>
      )}
    </Tap>
  );
}

export default NotificationBell;
