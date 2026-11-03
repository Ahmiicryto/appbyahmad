import { Alert, Platform } from "react-native";

// Native alert on phones, window.confirm in the web preview.
export function confirm(title, message, actionLabel) {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: actionLabel, style: "destructive", onPress: () => resolve(true) }
    ])
  );
}
