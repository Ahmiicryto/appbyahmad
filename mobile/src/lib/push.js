import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Linking, Platform } from "react-native";
import { api } from "./api";

// Remote push is not available everywhere:
// - Web and simulators/emulators can't get an Expo push token.
// - Android Expo Go dropped remote push in SDK 53; it needs a development build.
//   (Importing expo-notifications there logs an error, so it is loaded lazily.)
const isAndroidExpoGo = Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const pushSupported = Platform.OS !== "web" && Device.isDevice && !isAndroidExpoGo;

let Notifications = null;
function loadNotifications() {
  if (!pushSupported) return null;
  if (Notifications) return Notifications;
  try {
    Notifications = require("expo-notifications");
    // Show banners while the app is open too.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false })
    });
  } catch {
    Notifications = null;
  }
  return Notifications;
}

let lastToken = null;
export const currentPushToken = () => lastToken;

// Asks for permission, gets this device's Expo push token and saves it on the server.
// Returns the token, or null when push isn't available or the person said no. Never throws.
export async function registerForPushAsync() {
  try {
    const N = loadNotifications();
    if (!N) return null;

    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("default", {
        name: "Default",
        importance: N.AndroidImportance.DEFAULT
      });
    }

    let { status } = await N.getPermissionsAsync();
    if (status !== "granted") ({ status } = await N.requestPermissionsAsync());
    if (status !== "granted") return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token) return null;

    await api("/notifications/push-tokens", { method: "POST", body: { token, platform: Platform.OS === "ios" ? "ios" : "android" } });
    lastToken = token;
    return token;
  } catch {
    return null;
  }
}

// Call when signing out so this device stops getting the previous person's notifications.
export async function unregisterPushAsync() {
  if (!lastToken) return;
  const token = lastToken;
  lastToken = null;
  await api("/notifications/push-tokens", { method: "DELETE", body: { token } }).catch(() => {});
}

let lastOpenedId = null;
function openFromResponse(response) {
  // The launch tap can arrive both from getLastNotificationResponseAsync and the listener.
  const id = response?.notification?.request?.identifier;
  if (id && id === lastOpenedId) return;
  lastOpenedId = id ?? null;
  const url = response?.notification?.request?.content?.data?.url;
  if (typeof url !== "string" || !url) return;
  if (url.startsWith("/")) router.push(url);
  else if (/^https:\/\//i.test(url)) {
    // External links open in the browser.
    Linking.openURL(url).catch(() => {});
  }
}

// Registers this device once per sign-in and opens `data.url` when a notification is tapped.
export function usePushRegistration(signedIn) {
  const registered = useRef(false);

  useEffect(() => {
    if (!signedIn) {
      registered.current = false;
      return;
    }
    if (registered.current) return;
    registered.current = true;
    registerForPushAsync();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    const N = loadNotifications();
    if (!N) return;
    let sub;
    try {
      // A tap that launched the app from a killed state.
      N.getLastNotificationResponseAsync()
        .then((r) => {
          if (r) {
            openFromResponse(r);
            N.clearLastNotificationResponseAsync?.().catch(() => {});
          }
        })
        .catch(() => {});
      sub = N.addNotificationResponseReceivedListener(openFromResponse);
    } catch {
      return;
    }
    return () => sub?.remove();
  }, [signedIn]);
}
