import { Tabs } from "expo-router";
import { AssistantIcon, GoalsIcon, LifeIcon, ProgressIcon, TodayIcon } from "../../components/icons";
import { useApp } from "../../lib/AppContext";

export default function TabsLayout() {
  const { theme: t, signedIn, onboarded } = useApp();
  // The root layout redirects; render nothing meanwhile so no screen calls the API signed out.
  if (!signedIn || !onboarded) return null;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: t.bg },
        tabBarActiveTintColor: t.ink,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.line },
        tabBarLabelStyle: { fontWeight: "700", fontSize: 11 }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: ({ color }) => <TodayIcon color={color} /> }} />
      <Tabs.Screen name="goals" options={{ title: "Goals", tabBarIcon: ({ color }) => <GoalsIcon color={color} /> }} />
      <Tabs.Screen name="life" options={{ title: "Life", tabBarIcon: ({ color }) => <LifeIcon color={color} /> }} />
      <Tabs.Screen name="progress" options={{ title: "Progress", tabBarIcon: ({ color }) => <ProgressIcon color={color} /> }} />
      <Tabs.Screen name="assistant" options={{ title: "Assistant", tabBarIcon: ({ color }) => <AssistantIcon color={color} /> }} />
    </Tabs>
  );
}
