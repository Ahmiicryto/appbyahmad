import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../lib/AppContext";
import { areaColor, areaIcon } from "../theme/themes";
import { Icon } from "./icons";
import { Glass, T, Tap } from "./ui";

const SOURCE_LABEL = { goal: "Goal", fitness: "Fitness", money: "Money", career: "Career", custom: "Personal" };

export function TaskRow({ task, onToggle }) {
  const t = useTheme();
  const done = Boolean(task.done_at);
  const color = areaColor(t, task.source === "goal" ? task.goal_category : task.source);
  const area = task.source === "goal" ? task.goal_category || "goal" : task.source;
  const label = task.goal_title ? `${SOURCE_LABEL[task.source]} · ${task.goal_title}` : SOURCE_LABEL[task.source];
  return (
    <Tap
      onPress={() => onToggle(task)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={task.title}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
    >
      <Glass radius={18} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, paddingHorizontal: 12, paddingVertical: 9 }}>
      <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: done ? t.ink : t.muted, backgroundColor: done ? t.acc : "transparent", alignItems: "center", justifyContent: "center" }}>
        {done && (
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path d="M5 12l5 5L20 7" stroke={t.onAcc} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontWeight: "700", textDecorationLine: done ? "line-through" : "none" }} color={done ? t.muted : t.text}>{task.title}</T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Icon name={areaIcon(area)} color={color} size={13} strokeWidth={2} />
          <T v="small" color={color} style={{ fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>{label}</T>
        </View>
      </View>
      {task.due_time ? <T v="small" muted>{task.due_time}</T> : null}
      </Glass>
    </Tap>
  );
}
