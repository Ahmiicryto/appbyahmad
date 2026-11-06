import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/AppContext";
import { T, WEB_GLASS } from "./ui";

// Floating frosted pill tab bar. Used as <Tabs tabBar={(p) => <GlassTabBar {...p} />}>.
// Supports both tab bar APIs: Expo Router 58 passes `emitter` + `navigateToTab`; older React Navigation passes `navigation`.
export function GlassTabBar({ state, descriptors, navigation, emitter, navigateToTab }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 14, right: 14, bottom: Math.max(insets.bottom, 12) + 4 }}>
      <View
        style={{
          height: 66,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: t.line,
          overflow: "hidden",
          backgroundColor: t.dark ? "rgba(18,24,34,0.72)" : "rgba(255,255,255,0.72)",
          shadowColor: "#000",
          shadowOpacity: t.dark ? 0.45 : 0.14,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
          ...WEB_GLASS
        }}
      >
        {Platform.OS === "ios" && <BlurView intensity={40} tint={t.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
        <View style={{ flex: 1, flexDirection: "row", padding: 6, gap: 2 }} accessibilityRole="tablist">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const color = focused ? t.ink : t.muted;
            const onPress = () => {
              const events = emitter ?? navigation;
              const event = events?.emit?.({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (focused || event?.defaultPrevented) return;
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              if (navigateToTab) navigateToTab(route.key);
              else navigation?.navigate(route.name, route.params);
            };
            return (
              <Tab key={route.key} focused={focused} onPress={onPress} label={options.title ?? route.name} color={color}>
                {options.tabBarIcon?.({ focused, color, size: 22 })}
              </Tab>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function Tab({ focused, onPress, label, color, children }) {
  const t = useTheme();
  const a = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: focused ? 1 : 0, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, [a, focused]);
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 22 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 22, backgroundColor: t.soft, opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]} />
        <Animated.View style={{ transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [1, -1] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>{children}</Animated.View>
        <T v="tiny" color={color} style={{ fontSize: 10.5, fontWeight: "800" }} numberOfLines={1}>{label}</T>
      </View>
    </Pressable>
  );
}
