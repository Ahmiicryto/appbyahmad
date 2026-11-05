import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { useTheme } from "../lib/AppContext";

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// iOS: native blur view. Web: CSS backdrop-filter (an overlay would cover inputs and icons).
// Android: the same translucent glass without blur (cheaper, no artifacts).
const CAN_BLUR = Platform.OS === "ios";
export const WEB_GLASS = Platform.OS === "web" ? { backdropFilter: "blur(22px) saturate(160%)", WebkitBackdropFilter: "blur(22px) saturate(160%)" } : null;
export const TAB_BAR_SPACE = 112;

// ---------------------------------------------------------------- background

function Blob({ color, size, style, duration, reverse }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [a, duration]);
  const d = reverse ? -1 : 1;
  const id = `g${size}${duration}`;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: size, height: size }, style, {
        transform: [
          { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, 22 * d] }) },
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -18 * d] }) }
        ]
      }]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

// Soft, slowly drifting colour blobs behind the glass.
export function GlassBackground() {
  const t = useTheme();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden", backgroundColor: t.bg }]}>
      <Blob color={t.blob1} size={460} style={{ right: -160, top: -140 }} duration={7000} />
      <Blob color={t.blob2} size={420} style={{ left: -190, top: 300 }} duration={9000} reverse />
      <Blob color={t.blob3} size={360} style={{ right: -60, bottom: -140 }} duration={11000} />
    </View>
  );
}

export function Screen({ children, scroll = true, padded = true, edges = ["top"], tabBar = false, footer }) {
  const t = useTheme();
  const body = padded ? { padding: 18, gap: 12, paddingBottom: tabBar ? TAB_BAR_SPACE : 32 } : null;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <GlassBackground />
      <SafeAreaView edges={edges} style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView contentContainerStyle={body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        ) : (
          <View style={[{ flex: 1 }, body]}>{children}</View>
        )}
        {footer}
      </SafeAreaView>
    </View>
  );
}

// ---------------------------------------------------------------- text

const SIZES = { display: [32, "800"], h1: [27, "800"], h2: [20, "800"], h3: [16, "800"], body: [15, "500"], small: [13, "500"], tiny: [11, "700"] };

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
    <T v="tiny" color={color || t.muted} style={{ letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "800" }}>
      {children}
    </T>
  );
};

// ---------------------------------------------------------------- glass

export function Glass({ children, style, radius = 24, strong, border, intensity = 28 }) {
  const t = useTheme();
  const flat = StyleSheet.flatten(style) || {};
  const r = flat.borderRadius ?? radius;
  return (
    <View
      style={[
        {
          borderRadius: r,
          borderWidth: 1,
          borderColor: border || t.line,
          backgroundColor: strong ? t.s2 : t.s1,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: t.dark ? 0.35 : 0.1,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 }
        },
        WEB_GLASS,
        style
      ]}
    >
      {CAN_BLUR && <BlurView pointerEvents="none" intensity={intensity} tint={t.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  );
}

export function Card({ children, style, highlight, strong }) {
  return (
    <Glass border={highlight} strong={strong} style={[{ padding: 16, gap: 10 }, style]}>
      {children}
    </Glass>
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

// ---------------------------------------------------------------- animated emoji

const KINDS = {
  wave: { duration: 2400, input: [0, 0.1, 0.2, 0.3, 0.4, 0.6, 1], rotate: ["0deg", "16deg", "-8deg", "16deg", "-8deg", "0deg", "0deg"] },
  ring: { duration: 3000, input: [0, 0.8, 0.85, 0.9, 0.95, 1], rotate: ["0deg", "0deg", "-14deg", "14deg", "-14deg", "0deg"] },
  shine: { duration: 3500, input: [0, 0.7, 0.8, 0.9, 1], rotate: ["0deg", "0deg", "-12deg", "10deg", "0deg"], scale: [1, 1, 1.15, 1.15, 1] },
  bob: { duration: 1600, input: [0, 0.5, 1], translateY: [0, -4, 0], scale: [1, 1.12, 1] },
  float: { duration: 3200, input: [0, 0.5, 1], translateY: [0, -8, 0], rotate: ["-6deg", "6deg", "-6deg"] },
  flame: { duration: 1400, input: [0, 0.5, 1], scale: [1, 1.15, 1], rotate: ["0deg", "-6deg", "0deg"] },
  pulse: { duration: 1800, input: [0, 0.5, 1], scale: [1, 1.1, 1] },
  spin: { duration: 8000, input: [0, 1], rotate: ["0deg", "360deg"], linear: true }
};

export function Emoji({ e, size = 20, anim, delay = 0, style }) {
  const a = useRef(new Animated.Value(0)).current;
  const k = anim ? KINDS[anim] : null;
  useEffect(() => {
    if (!k) return undefined;
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: k.duration, delay, easing: k.linear ? Easing.linear : Easing.inOut(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a, k, delay]);
  const transform = [];
  if (k?.translateY) transform.push({ translateY: a.interpolate({ inputRange: k.input, outputRange: k.translateY }) });
  if (k?.rotate) transform.push({ rotate: a.interpolate({ inputRange: k.input, outputRange: k.rotate }) });
  if (k?.scale) transform.push({ scale: a.interpolate({ inputRange: k.input, outputRange: k.scale }) });
  return (
    <Animated.Text accessible={false} importantForAccessibility="no" style={[{ fontSize: size, lineHeight: size * 1.2, transform }, style]}>
      {e}
    </Animated.Text>
  );
}

// ---------------------------------------------------------------- controls

export function Button({ title, onPress, variant = "primary", disabled, busy, pulse, style, accessibilityLabel, emoji, small }) {
  const t = useTheme();
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!pulse) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1300, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, glow]);
  const primary = variant === "primary";
  const danger = variant === "danger";
  const fg = primary ? t.onAcc : danger ? t.bad : t.text;
  const h = small ? 42 : 54;
  const inner = (
    <>
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {emoji ? <Text style={{ fontSize: small ? 15 : 17 }}>{emoji}</Text> : null}
          <T v={small ? "small" : "h3"} color={fg} style={{ fontWeight: "800" }}>{title}</T>
        </View>
      )}
    </>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      accessibilityLabel={accessibilityLabel || title}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {pulse && !disabled && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: 18, backgroundColor: t.glow, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }), transform: [{ scaleX: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }, { scaleY: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }]}
        />
      )}
      {primary ? (
        <View style={{ minHeight: h, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, backgroundColor: t.acc, borderWidth: 1, borderColor: t.pbd }}>{inner}</View>
      ) : (
        <Glass radius={18} border={danger ? t.bad : undefined} style={{ minHeight: h, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }}>{inner}</Glass>
      )}
    </Pressable>
  );
}

export function Field({ label, error, style, emoji, right, valid, ...input }) {
  const t = useTheme();
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <T v="small" muted style={{ fontWeight: "800" }}>{label}</T> : null}
      <Glass radius={16} border={error ? t.bad : valid ? t.good : undefined} style={{ flexDirection: "row", alignItems: "center", minHeight: 52, paddingHorizontal: 14, gap: 10 }}>
        {emoji ? <Text style={{ fontSize: 17 }} accessible={false}>{emoji}</Text> : null}
        <TextInput
          placeholderTextColor={t.muted}
          accessibilityLabel={label || input.placeholder}
          style={[{ flex: 1, minHeight: 50, color: t.text, fontSize: 16, fontWeight: "600" }, Platform.OS === "web" && { outlineStyle: "none" }]}
          {...input}
        />
        {right}
      </Glass>
      {error ? <T v="small" color={t.bad} style={{ fontWeight: "700" }}>{error}</T> : null}
    </View>
  );
}

export function IconButton({ onPress, label, children, size = 44 }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Glass radius={14} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>{children}</Glass>
    </Pressable>
  );
}

export function Chevron({ color, dir = "left", size = 20 }) {
  const d = { left: "M15 18l-6-6 6-6", right: "M9 6l6 6-6 6", down: "M6 9l6 6 6-6" }[dir];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Glass back button + title + optional right side.
export function Header({ title, right, onBack }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}>
      <IconButton label="Back" onPress={onBack || (() => (router.canGoBack() ? router.back() : router.replace("/")))}>
        <Chevron color={t.text} />
      </IconButton>
      <T v="h1" style={{ flex: 1, fontSize: 25 }} numberOfLines={1}>{title}</T>
      {right}
    </View>
  );
}

export function Pill({ children, color, bg, emoji, style }) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: bg || t.soft, alignSelf: "flex-start" }, style]}>
      {emoji ? <Text style={{ fontSize: 12 }}>{emoji}</Text> : null}
      <T v="tiny" color={color || t.ink} style={{ fontWeight: "800" }}>{children}</T>
    </View>
  );
}

export function Toggle({ value, onChange, label, disabled }) {
  const t = useTheme();
  const a = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: value ? 1 : 0, duration: 220, easing: EASE, useNativeDriver: false }).start();
  }, [a, value]);
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: Boolean(value), disabled: Boolean(disabled) }}
      hitSlop={8}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View style={{ width: 50, height: 30, borderRadius: 15, borderWidth: 1, borderColor: value ? t.pbd : t.line, backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: [t.track, t.acc] }), justifyContent: "center" }}>
        <Animated.View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }) }] }} />
      </Animated.View>
    </Pressable>
  );
}

export function Checkbox({ checked, onChange, children }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(checked) }} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", minHeight: 44, paddingVertical: 4 }}>
      <View style={{ width: 22, height: 22, borderRadius: 7, marginTop: 1, borderWidth: 1.5, borderColor: checked ? t.ink : t.muted, backgroundColor: checked ? t.acc : "transparent", alignItems: "center", justifyContent: "center" }}>
        {checked && (
          <Svg width={13} height={13} viewBox="0 0 24 24"><Path d="M5 12l5 5L20 7" stroke={t.onAcc} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>
        )}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

// Segmented control: [{ value, label, emoji }]
export function Segmented({ options, value, onChange, label }) {
  const t = useTheme();
  return (
    <Glass radius={18} strong style={{ flexDirection: "row", padding: 4, gap: 4 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flex: 1, flexDirection: "row", gap: 4 }}>
        {options.map((o) => {
          const sel = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: sel }}
              style={{ flex: 1, minHeight: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: sel ? t.acc : "transparent" }}
            >
              {o.emoji ? <Text style={{ fontSize: 14 }}>{o.emoji}</Text> : null}
              <T v="small" color={sel ? t.onAcc : t.text} style={{ fontWeight: "800" }}>{o.label}</T>
              {o.badge ? <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: t.c3 }}><T v="tiny" color="#06231D">{o.badge}</T></View> : null}
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

// Photo, emoji, or initials on a gradient.
export function Avatar({ profile, size = 46, ring }) {
  const t = useTheme();
  const a = profile?.avatar;
  const isPhoto = typeof a === "string" && a.startsWith("data:image/");
  const initials = (profile?.name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  const inner = size - (ring ? 8 : 0);
  const body = isPhoto ? (
    <Image source={{ uri: a }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} accessibilityIgnoresInvertColors />
  ) : a ? (
    <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: inner * 0.5 }}>{a}</Text>
    </View>
  ) : (
    <LinearGradient colors={[t.acc, t.ink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: inner, height: inner, borderRadius: inner / 2, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: inner * 0.34, fontWeight: "800", color: t.onAcc }}>{initials}</Text>
    </LinearGradient>
  );
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={profile?.name ? `${profile.name}'s photo` : "Profile photo"} style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", borderWidth: ring ? 2 : 1, borderColor: ring ? t.ink : t.pbd }}>
      {body}
    </View>
  );
}

// ---------------------------------------------------------------- data viz

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

export function Chip({ label, selected, onPress, accessibilityRole = "radio", emoji }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole={accessibilityRole} accessibilityState={{ selected: Boolean(selected), checked: Boolean(selected) }}>
      <Glass radius={14} border={selected ? t.ink : undefined} style={{ minHeight: 44, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: selected ? t.soft : t.s1 }}>
        {emoji ? <Text style={{ fontSize: 15 }}>{emoji}</Text> : null}
        <T v="small" color={selected ? t.ink : t.text} style={{ fontWeight: "800" }}>{label}</T>
      </Glass>
    </Pressable>
  );
}

export function ErrorBox({ error, onRetry }) {
  const t = useTheme();
  if (!error) return null;
  return (
    <Card highlight={t.bad}>
      <T color={t.bad} style={{ fontWeight: "700" }}>😕 {error.message}</T>
      {onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} />}
    </Card>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg, padding: 40 }}>
      <GlassBackground />
      <ActivityIndicator color={t.ink} />
    </View>
  );
}
