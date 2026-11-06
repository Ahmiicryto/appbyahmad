import Constants from "expo-constants";

// Set EXPO_PUBLIC_API_URL (e.g. https://appbyahmad-api.onrender.com) or app.json > extra.apiUrl.
// The web build served by the API server itself (EXPO_PUBLIC_SAME_ORIGIN=1) calls the API on its own address,
// so it keeps working on any domain (Railway URL or your own domain).
const sameOrigin = process.env.EXPO_PUBLIC_SAME_ORIGIN === "1" && typeof window !== "undefined" && window.location?.origin;
export const API_URL = (sameOrigin || process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || "http://localhost:3000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || "Something went wrong. Check your connection and try again.");
    this.status = status;
    this.code = body?.error?.code;
    this.fields = body?.error?.fields;
  }
}

let authToken = null;
let onUnauthorized = () => {};
export const setAuthToken = (t) => (authToken = t);
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(0, { error: { message: "Can't reach the server. Check your internet connection." } });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (res.status === 401 && authToken) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
