import { Stack } from "expo-router";
import { useTheme } from "../../lib/AppContext";

// Signed-out users land on the welcome screen.
export const unstable_settings = { initialRouteName: "welcome" };

export default function AuthLayout() {
  const t = useTheme();
  return (
    <Stack initialRouteName="welcome" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}
