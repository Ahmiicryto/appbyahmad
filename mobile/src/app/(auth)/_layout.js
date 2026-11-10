import { Stack } from "expo-router";
import { useTheme } from "../../lib/AppContext";

export default function AuthLayout() {
  const t = useTheme();
  return (
    <Stack initialRouteName="welcome" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: "slide_from_right", animationDuration: 260 }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}
