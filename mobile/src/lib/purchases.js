// App Store / Google Play subscriptions through RevenueCat.
//
// - Keys come from the server (admin Settings → In-app purchases), so they can change without an app update.
// - We log in to RevenueCat with our own user id, so the server's webhook knows who bought what.
// - In Expo Go, RevenueCat runs in "preview mode" (no real charges). Real purchases need a development or store
//   build made with EAS, and products set up in App Store Connect / Play Console.
// - On the web there are no store purchases: the plans screen uses Stripe checkout instead.
import { Linking, Platform } from "react-native";

export const storePlatform = Platform.OS === "ios" || Platform.OS === "android";

let Purchases = null;
let current = null; // { key, userId }

function sdk() {
  if (!storePlatform) return null;
  if (!Purchases) {
    try {
      Purchases = require("react-native-purchases").default;
    } catch {
      Purchases = null;
    }
  }
  return Purchases;
}

const keyFor = (config) => (Platform.OS === "ios" ? config?.purchases?.iosKey : config?.purchases?.androidKey) || null;

export function storeAvailable(config) {
  return Boolean(storePlatform && config?.purchases?.enabled && keyFor(config) && sdk());
}

// Safe to call many times. Returns false when store purchases aren't available here.
export async function ensurePurchases(config, userId) {
  const P = sdk();
  const key = keyFor(config);
  if (!P || !key || !userId) return false;
  if (!current || current.key !== key) {
    P.configure({ apiKey: key, appUserID: userId });
    current = { key, userId };
  } else if (current.userId !== userId) {
    await P.logIn(userId);
    current = { key, userId };
  }
  return true;
}

export async function logOutPurchases() {
  const P = sdk();
  if (!P || !current?.userId) return;
  try {
    await P.logOut();
  } catch {
    // Already anonymous: nothing to do.
  }
  current = { ...current, userId: null };
}

// Store packages in the current offering, keyed by product id (Google's ":base-plan" suffix removed).
export async function loadPackages() {
  const P = sdk();
  if (!P) return {};
  const offerings = await P.getOfferings();
  const out = {};
  for (const pkg of offerings?.current?.availablePackages ?? []) {
    const id = pkg.product?.identifier;
    if (!id) continue;
    out[id] = pkg;
    out[id.split(":")[0]] = out[id.split(":")[0]] || pkg;
    if (pkg.packageType === "MONTHLY") out.$monthly = pkg;
    if (pkg.packageType === "ANNUAL") out.$annual = pkg;
  }
  return out;
}

// Match an admin plan to a store package: exact product id first, then by billing period.
export function packageForPlan(packages, plan) {
  if (!plan) return null;
  const id = plan.store_product_id;
  return (id && (packages[id] || packages[id.split(":")[0]])) || (plan.interval === "year" ? packages.$annual : packages.$monthly) || null;
}

// Resolves { ok: true, active } or { ok: false, cancelled } — never throws for a user cancel.
export async function buyPackage(pkg, entitlement = "premium") {
  const P = sdk();
  try {
    const { customerInfo } = await P.purchasePackage(pkg);
    return { ok: true, active: Boolean(customerInfo?.entitlements?.active?.[entitlement]), managementURL: customerInfo?.managementURL };
  } catch (err) {
    if (err?.userCancelled) return { ok: false, cancelled: true };
    throw new Error(friendly(err));
  }
}

export async function restorePurchases(entitlement = "premium") {
  const P = sdk();
  try {
    const info = await P.restorePurchases();
    return { active: Boolean(info?.entitlements?.active?.[entitlement]), managementURL: info?.managementURL };
  } catch (err) {
    throw new Error(friendly(err));
  }
}

export async function openManageSubscriptions() {
  const P = sdk();
  let url = null;
  try {
    url = (await P?.getCustomerInfo())?.managementURL;
  } catch {
    // Fall back to the store's subscription page.
  }
  url ||= Platform.OS === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions";
  await Linking.openURL(url);
}

function friendly(err) {
  const code = err?.code;
  if (code === "PAYMENT_PENDING_ERROR" || code === "3") return "Your payment is pending. Premium unlocks as soon as the store confirms it.";
  if (code === "NETWORK_ERROR" || code === "10") return "Can't reach the store. Check your internet connection and try again.";
  if (code === "PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR" || code === "5") return "This plan isn't available in your store yet. Try again later.";
  if (code === "PURCHASE_NOT_ALLOWED_ERROR" || code === "2") return "Purchases are turned off on this device (check Screen Time or parental controls).";
  return err?.message || "The purchase didn't go through. You weren't charged. Try again.";
}
