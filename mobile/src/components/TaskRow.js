import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../lib/AppContext";
import { areaColor } from "../theme/themes";
import { T } from "./ui";

const SOURCE_LABEL = { goal: "Goal", fitness: "Fitness", money: "Money", career: "Career", custom: "Personal" };

export function TaskRow({ task, onToggle }) {
  const t = useTheme();
  const done = Boolean(task.done_at);
  const color = areaColor(t, task.source === "goal" ? task.goal_category : task.source);
  const label = task.goal_title ? `${SOURCE_LABEL[task.source]} · ${task.goal_title}` : SOURCE_LABEL[task.source];
  return (
    <Pressable
      onPress={() => onToggle(task)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={task.title}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1, opacity: pressed ? 0.8 : 1
      })}
    >
      <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: done ? t.acc : t.line, backgroundColor: done ? t.acc : "transparent", alignItems: "center", justifyContent: "center" }}>
        {done && (
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path d="M5 12l5 5L20 7" stroke={t.onAcc} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontWeight: "700", textDecorationLine: done ? "line-through" : "none" }} color={done ? t.muted : t.text}>{task.title}</T>
        <T v="small" color={color} style={{ fontWeight: "700" }} numberOfLines={1}>{label}</T>
      </View>
      {task.due_time ? <T v="small" muted>{task.due_time}</T> : null}
    </Pressable>
  );
}
