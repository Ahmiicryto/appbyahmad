import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// The sign-in token goes in the iOS Keychain / Android Keystore. The web preview falls back to localStorage.
export async function getItem(key) {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key, value) {
  if (Platform.OS === "web") {
    try {
      value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
    } catch {
      /* private mode: stays signed in for this tab only */
    }
    return;
  }
  return value == null ? SecureStore.deleteItemAsync(key) : SecureStore.setItemAsync(key, value);
}
