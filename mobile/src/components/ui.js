import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../lib/AppContext";

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function Screen({ children, scroll = true, padded = true, edges = ["top"] }) {
  const t = useTheme();
  const body = padded ? { padding: 20, gap: 14, paddingBottom: 32 } : null;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const SIZES = { h1: [28, "800"], h2: [20, "800"], h3: [16, "800"], body: [15, "500"], small: [13, "500"], tiny: [11, "700"] };

export function T({ v = "body", color, muted, style, children, ...rest }) {
  const t = useTheme();
  const [size, weight] = SIZES[v];
  return (
    <Text
      style={[{ fontSize: size, fontWeight: weight, color: color || (muted ? t.muted : t.text), letterSpacing: size >= 20 ? -0.4 : 0 }, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}

export const Overline = ({ children, color }) => {
  const t = useTheme();
  return (
    <T v="tiny" color={color || t.ink} style={{ letterSpacing: 1.2, textTransform: "uppercase" }}>
      {children}
    </T>
  );
};

export function Card({ children, style, highlight }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.s1, borderColor: highlight || t.line, borderWidth: 1, borderRadius: 22, padding: 16, gap: 10 }, style]}>
      {children}
    </View>
  );
}

// Fades and slides content up on mount; stagger with `delay`.
export function Rise({ delay = 0, children, style }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 550, delay, easing: EASE, useNativeDriver: true }).start();
  }, [a, delay]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

export function Button({ title, onPress, variant = "primary", disabled, busy, pulse, style, accessibilityLabel }) {
  const t = useTheme();
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, glow]);
  const primary = variant === "primary";
  const danger = variant === "danger";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={({ pressed }) => [
        {
          minHeight: 52,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 18,
          backgroundColor: primary ? t.acc : t.s1,
          borderWidth: primary ? 0 : 1,
          borderColor: danger ? t.bad : t.line,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        },
        style
      ]}
    >
      {pulse && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: 18, borderWidth: 2, borderColor: t.ink, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] }]}
        />
      )}
      {busy ? (
        <ActivityIndicator color={primary ? t.onAcc : t.text} />
      ) : (
        <T v="h3" color={primary ? t.onAcc : danger ? t.bad : t.text}>{title}</T>
      )}
    </Pressable>
  );
}

export function Field({ label, error, style, ...input }) {
  const t = useTheme();
  return (
    <View style={[{ gap: 6 }, style]}>
      <T v="small" muted style={{ fontWeight: "700" }}>{label}</T>
      <TextInput
        placeholderTextColor={t.muted}
        accessibilityLabel={label}
        style={{ minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: error ? t.bad : t.line, backgroundColor: t.s1, color: t.text, paddingHorizontal: 14, fontSize: 16 }}
        {...input}
      />
      {error ? <T v="small" color={t.bad}>{error}</T> : null}
    </View>
  );
}

// Progress ring that draws itself in. `value` is 0-100.
export function Ring({ size = 108, stroke = 10, value = 0, color, children, delay = 150, label }) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: Math.max(0, Math.min(100, value)), duration: 1300, delay, easing: EASE, useNativeDriver: false }).start();
  }, [a, value, delay]);
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color || t.ink}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={a.interpolate({ inputRange: [0, 100], outputRange: [c, 0] })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>{children}</View>
    </View>
  );
}

// Horizontal bar that grows in. `value` is 0-100.
export function Bar({ value = 0, color, height = 8, delay = 200 }) {
  const t = useTheme();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: Math.max(0, Math.min(100, value)), duration: 1000, delay, easing: EASE, useNativeDriver: false }).start();
  }, [a, value, delay]);
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: t.track, overflow: "hidden" }}>
      <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: color || t.ink, width: a.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
}

export function Chip({ label, selected, onPress, accessibilityRole = "radio" }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected: Boolean(selected), checked: Boolean(selected) }}
      style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 14, justifyContent: "center", borderWidth: 1.5, borderColor: selected ? t.ink : t.line, backgroundColor: selected ? t.soft : t.s1 }}
    >
      <T v="small" color={selected ? t.ink : t.text} style={{ fontWeight: "700" }}>{label}</T>
    </Pressable>
  );
}

export function ErrorBox({ error, onRetry }) {
  const t = useTheme();
  if (!error) return null;
  return (
    <Card highlight={t.bad}>
      <T color={t.bad} style={{ fontWeight: "700" }}>{error.message}</T>
      {onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} />}
    </Card>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg, padding: 40 }}>
      <ActivityIndicator color={t.ink} />
    </View>
  );
}
