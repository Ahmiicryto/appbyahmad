import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, Line, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../lib/AppContext";
import { byId } from "../lib/exercises";
import { TONES } from "./ui";

const ALine = Animated.createAnimatedComponent(Line);
const ACircle = Animated.createAnimatedComponent(Circle);
const AEllipse = Animated.createAnimatedComponent(Ellipse);

const BONES = [
  // [from, to, layer] — far limbs first so near limbs draw on top.
  ["hip", "kL", "far"], ["kL", "fL", "far"], ["neck", "eL", "far"], ["eL", "hL", "far"],
  ["neck", "hip", "torso"],
  ["hip", "kR", "near"], ["kR", "fR", "near"], ["neck", "eR", "near"], ["eR", "hR", "near"]
];

// Looping animated exercise demo built from pose keyframes (see lib/exercises.js).
export function ExerciseFigure({ id, size = 160, playing = true, backdrop = true }) {
  const t = useTheme();
  const ex = byId[id];
  const a = useRef(new Animated.Value(0)).current;
  const poses = ex?.poses ?? [];
  const frames = poses.length > 1 ? [...poses, poses[0]] : poses;
  const input = frames.map((_, i) => (frames.length > 1 ? i / (frames.length - 1) : 0));
  const [top, bottom] = TONES[ex?.tone] ?? TONES.violet;

  useEffect(() => {
    if (!playing || frames.length < 2) return undefined;
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: (ex.tempo ?? 1600) * (frames.length - 1) / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: false }));
    a.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [a, playing, ex, frames.length]);

  // One interpolation per joint coordinate.
  const pos = useMemo(() => {
    if (!frames.length) return {};
    const out = {};
    for (const joint of Object.keys(frames[0])) {
      out[joint] = frames.length > 1
        ? [a.interpolate({ inputRange: input, outputRange: frames.map((f) => f[joint][0]) }), a.interpolate({ inputRange: input, outputRange: frames.map((f) => f[joint][1]) })]
        : frames[0][joint];
    }
    return out;
  }, [a, ex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ex) return <View style={{ width: size, height: size }} />;
  const gid = `g-${id}`;
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={`${ex.name} demonstration`}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`${gid}-bg`} cx="50%" cy="45%" r="60%">
            <Stop offset="0" stopColor={top} stopOpacity={t.dark ? 0.28 : 0.22} />
            <Stop offset="1" stopColor={top} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {backdrop && <Circle cx="50" cy="50" r="50" fill={`url(#${gid}-bg)`} />}
        {ex.prop === "wall" && <Rect x="22" y="8" width="5" height="84" rx="1.5" fill={t.track} />}
        {ex.prop === "bench" && <Rect x="12" y="62" width="20" height="6" rx="2" fill={t.track} />}
        <Line x1="6" y1="92" x2="94" y2="92" stroke={t.track} strokeWidth="1.2" strokeLinecap="round" />
        <AEllipse cx={pos.hip[0]} cy="92.5" rx="16" ry="2.2" fill="#000" opacity={t.dark ? 0.35 : 0.12} />
        {BONES.map(([from, to, layer], i) => (
          <ALine
            key={i}
            x1={pos[from][0]} y1={pos[from][1]} x2={pos[to][0]} y2={pos[to][1]}
            stroke={layer === "near" ? top : bottom}
            strokeOpacity={layer === "far" ? 0.45 : 1}
            strokeWidth={layer === "torso" ? 7.5 : 5.2}
            strokeLinecap="round"
          />
        ))}
        <ACircle cx={pos.head[0]} cy={pos.head[1]} r="6.4" fill={top} />
        <ACircle cx={pos.head[0]} cy={pos.head[1]} r="6.4" fill="#FFFFFF" opacity="0.18" />
      </Svg>
    </View>
  );
}
