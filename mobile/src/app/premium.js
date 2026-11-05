// Plans & Premium.
// iOS / Android: App Store and Google Play subscriptions through RevenueCat (required by store rules).
// Web: Stripe checkout. Prices, features and trials come from admin → Plans.
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import { Button, Card, Emoji, ErrorBox, Glass, Header, Loading, Pill, Rise, Screen, Segmented, T } from "../components/ui";
import { api } from "../lib/api";
import { useApp, useTheme } from "../lib/AppContext";
import { useAppConfig } from "../lib/appConfig";
import { buyPackage, ensurePurchases, loadPackages, openManageSubscriptions, packageForPlan, restorePurchases, storeAvailable } from "../lib/purchases";
import { useLoad } from "../lib/useLoad";

const money = (cents, currency = "usd") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
};

const PERKS = [
  ["🎯", "Unlimited goals", "Plan every part of your life"],
  ["🔄", "Adaptive daily plans", "Your plan adjusts when life happens"],
  ["💰", "Money, Fitness & Nutrition", "Full trackers with smart tips"],
  ["🚀", "Career & Future Me", "Decisions, skills and long-term vision"],
  ["📊", "Weekly & monthly reviews", "See what's working at a glance"],
  ["🚫", "No ads, ever", "Just you and your goals"]
];

export default function Premium() {
  const t = useTheme();
  const { user, refreshUser } = useApp();
  const { config } = useAppConfig();
  const { data, error, loading, reload } = useLoad("/billing/plans");
  const billing = useLoad(user?.isPremium ? "/billing/me" : null);
  const [period, setPeriod] = useState("year");
  const [choice, setChoice] = useState("premium");
  const [packages, setPackages] = useState({});
  const [storeReady, setStoreReady] = useState(false);
  const [busy, setBusy] = useState(null); // "buy" | "restore" | "manage"
  const [actionError, setActionError] = useState(null);
  const [message, setMessage] = useState(null);
  const useStore = storeAvailable(config);
  const entitlement = config.purchases?.entitlement || "premium";

  useEffect(() => {
    if (!useStore || !user?.id) return undefined;
    let alive = true;
    (async () => {
      try {
        if (!(await ensurePurchases(config, user.id))) return;
        const pkgs = await loadPackages();
        if (alive) {
          setPackages(pkgs);
          setStoreReady(true);
        }
      } catch (err) {
        if (alive) setActionError(new Error(`Couldn't load store prices: ${err.message}`));
      }
    })();
    return () => {
      alive = false;
    };
  }, [useStore, user?.id, config]);

  const plans = data?.plans ?? [];
  const byInterval = useMemo(() => ({ month: plans.find((p) => p.interval === "month"), year: plans.find((p) => p.interval === "year") }), [plans]);
  const hasBoth = Boolean(byInterval.month && byInterval.year);
  const plan = byInterval[period] || byInterval.month || byInterval.year || null;
  const pkg = useStore ? packageForPlan(packages, plan) : null;
  // Store price (localized, what they'll actually pay) beats the admin price.
  const price = pkg?.product?.priceString || (plan ? money(plan.price_cents, plan.currency) : "");
  const perMonth = plan?.interval === "year"
    ? (pkg?.product?.price ? pkg.product.priceString.replace(/[\d.,]+/, (pkg.product.price / 12).toFixed(2)) : money(Math.round(plan.price_cents / 12), plan.currency))
    : null;
  const savePct = hasBoth ? Math.max(0, Math.round(100 - (byInterval.year.price_cents / (byInterval.month.price_cents * 12)) * 100)) : 0;
  const trial = plan?.trial_days || 0;
  const canBuy = useStore ? Boolean(storeReady && pkg) : Boolean(data?.paymentsEnabled);

  async function afterPurchase(activeLocally) {
    try {
      if (useStore) await api("/billing/revenuecat/sync", { method: "POST" });
    } catch {
      // Webhook will catch up; the store already confirmed the purchase.
    }
    const me = await refreshUser().catch(() => null);
    if (me?.isPremium) setMessage("🎉 Welcome to Premium! Everything is unlocked.");
    else if (activeLocally) setMessage("🎉 Purchase complete. Premium will switch on in a moment.");
    else setMessage("If you completed payment, Premium will be active in a moment.");
  }

  async function subscribe() {
    if (choice === "free") return router.back();
    if (!plan) return;
    setBusy("buy");
    setActionError(null);
    setMessage(null);
    try {
      if (useStore) {
        if (!pkg) throw new Error("This plan isn't available in the store yet. Try again later.");
        const r = await buyPackage(pkg, entitlement);
        if (r.ok) await afterPurchase(r.active);
      } else {
        const { url } = await api("/billing/checkout", { method: "POST", body: { plan_id: plan.id } });
        await WebBrowser.openBrowserAsync(url);
        await afterPurchase(false);
      }
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    setActionError(null);
    setMessage(null);
    try {
      await ensurePurchases(config, user.id);
      const r = await restorePurchases(entitlement);
      if (r.active) await afterPurchase(true);
      else setMessage("We didn't find an active subscription for this store account.");
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  }

  async function manage() {
    setBusy("manage");
    setActionError(null);
    try {
      const provider = billing.data?.subscription?.provider;
      if (provider === "apple" || provider === "google") {
        if (storeAvailable(config)) await ensurePurchases(config, user.id);
        await openManageSubscriptions();
      } else if (provider === "stripe") {
        const { url } = await api("/billing/portal", { method: "POST" });
        await WebBrowser.openBrowserAsync(url);
      } else {
        setMessage("Your Premium was added by our team. Contact support to change it.");
      }
      await refreshUser().catch(() => {});
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) return <Loading />;

  const legal = config.legal || {};
  const footer = !user?.isPremium && plans.length > 0 && (
    <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 4 : 14, gap: 8 }}>
      <Button
        title={choice === "free" ? "Continue with Free" : trial > 0 ? `Start ${trial}-day free trial` : "Subscribe now"}
        emoji={choice === "free" ? null : "🎉"}
        pulse={choice !== "free"}
        busy={busy === "buy"}
        disabled={choice !== "free" && !canBuy}
        onPress={subscribe}
      />
      <T v="tiny" muted style={{ textAlign: "center", fontWeight: "600", lineHeight: 16 }}>
        {choice === "free"
          ? "You can upgrade anytime from your Profile."
          : `${trial > 0 ? `Free for ${trial} days, then ` : ""}${price} per ${plan?.interval}. Renews automatically. Cancel anytime in ${useStore ? (Platform.OS === "ios" ? "your Apple ID settings" : "Google Play") : "Settings"}.`}
      </T>
    </View>
  );

  return (
    <Screen footer={footer}>
      <Header
        title=""
        right={useStore && !user?.isPremium ? (
          <Pressable onPress={restore} accessibilityRole="button" disabled={Boolean(busy)} hitSlop={8}>
            <T v="small" color={t.ink} style={{ fontWeight: "800" }}>{busy === "restore" ? "Restoring…" : "Restore purchases"}</T>
          </Pressable>
        ) : null}
      />

      <Rise style={{ alignItems: "center", gap: 6 }}>
        <Emoji e="👑" size={48} anim="float" />
        <T v="h1" style={{ textAlign: "center" }}>{user?.isPremium ? "You're on Premium" : "Unlock your full life plan"}</T>
        <T muted style={{ textAlign: "center", lineHeight: 21, maxWidth: 320 }}>
          {user?.isPremium
            ? "Thanks for supporting the app. Every feature is unlocked."
            : trial > 0 ? `Try Premium free for ${trial} days. Cancel before it ends and you won't be charged.` : "Unlimited goals, adaptive plans and every life area."}
        </T>
      </Rise>

      {error && !data ? <ErrorBox error={error} onRetry={reload} /> : null}

      {user?.isPremium ? (
        <Rise delay={60} style={{ gap: 10 }}>
          <Card highlight={t.pbd} strong>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: t.acc, alignItems: "center", justifyContent: "center" }}><Emoji e="👑" size={22} anim="shine" /></View>
              <View style={{ flex: 1 }}>
                <T v="h3">{billing.data?.subscription?.plan_name || "Premium"}</T>
                <T v="small" muted>
                  {billing.data?.subscription?.current_period_end
                    ? `${billing.data.subscription.cancel_at_period_end ? "Ends" : "Renews"} ${new Date(billing.data.subscription.current_period_end).toLocaleDateString()}`
                    : "Active"}
                  {billing.data?.subscription?.provider === "apple" ? " · App Store" : billing.data?.subscription?.provider === "google" ? " · Google Play" : ""}
                </T>
              </View>
            </View>
          </Card>
          <Button title="Manage subscription" emoji="💳" variant="secondary" busy={busy === "manage"} onPress={manage} />
        </Rise>
      ) : plans.length ? (
        <>
          {hasBoth && (
            <Rise delay={40}>
              <Segmented
                label="Billing period"
                value={period}
                onChange={setPeriod}
                options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly", badge: savePct > 0 ? `Save ${savePct}%` : null }]}
              />
            </Rise>
          )}

          <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
            <Rise delay={90}>
              <PlanCard
                selected={choice === "free"}
                onPress={() => setChoice("free")}
                emoji="🌱"
                name="Free"
                sub="Get started, no card needed"
                price={money(0)}
                per="forever"
                feats={[["🎯", "A few goals"], ["📓", "Journal"], ["✖️", "Adaptive plans", true], ["✖️", "Weekly reviews", true]]}
              />
            </Rise>
            <Rise delay={150}>
              <PlanCard
                selected={choice === "premium"}
                onPress={() => setChoice("premium")}
                emoji="👑"
                name="Premium"
                popular
                sub={plan?.interval === "year" && perMonth ? `${perMonth}/month, billed yearly` : plan?.description || "Billed every month"}
                price={price}
                per={plan?.interval === "year" ? "per year" : "per month"}
                feats={[["♾️", "Unlimited goals"], ["🔄", "Adaptive plans"], ["📊", "Weekly reviews"], ["🚫", "No ads"]]}
              />
            </Rise>
          </View>

          {useStore && !storeReady && !actionError ? <T v="small" muted style={{ textAlign: "center" }}>Loading store prices…</T> : null}
          {!useStore && !data?.paymentsEnabled ? (
            <Card><T v="h3">⏳ Premium purchases open soon</T><T muted>We'll let you know when you can upgrade.</T></Card>
          ) : null}

          <Rise delay={210}>
            <Card>
              <T v="h3">Everything in Premium</T>
              {(plan?.features?.length ? plan.features.map((f, i) => [PERKS[i % PERKS.length][0], f, null]) : PERKS).map(([e, label, sub]) => (
                <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }}><T>{e}</T></View>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: "800" }}>{label}</T>
                    {sub ? <T v="small" muted>{sub}</T> : null}
                  </View>
                </View>
              ))}
            </Card>
          </Rise>

          <View style={{ flexDirection: "row", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <T v="small" muted style={{ fontWeight: "700" }}>🔒 Secure payment</T>
            <T v="small" muted style={{ fontWeight: "700" }}>↩️ Cancel anytime</T>
          </View>
        </>
      ) : data ? (
        <Card><T muted>No plans are available right now. Check back soon.</T></Card>
      ) : null}

      {(legal.termsUrl || legal.privacyUrl) && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 18 }}>
          {legal.termsUrl ? <Pressable onPress={() => Linking.openURL(legal.termsUrl)} accessibilityRole="link"><T v="small" color={t.ink} style={{ fontWeight: "700" }}>Terms of use</T></Pressable> : null}
          {legal.privacyUrl ? <Pressable onPress={() => Linking.openURL(legal.privacyUrl)} accessibilityRole="link"><T v="small" color={t.ink} style={{ fontWeight: "700" }}>Privacy policy</T></Pressable> : null}
        </View>
      )}

      {message ? <Card highlight={t.good}><T style={{ fontWeight: "700" }}>{message}</T></Card> : null}
      {actionError ? <ErrorBox error={actionError} /> : null}
    </Screen>
  );
}

function PlanCard({ selected, onPress, emoji, name, sub, price, per, feats, popular }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${name}, ${price} ${per}`}>
      {({ pressed }) => (
        <Glass radius={24} border={selected ? t.ink : undefined} style={{ padding: 16, gap: 12, borderWidth: 2, backgroundColor: selected ? t.soft : t.s1, transform: [{ scale: pressed ? 0.98 : selected ? 1 : 0.985 }] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: selected ? t.acc : t.s2, alignItems: "center", justifyContent: "center" }}>
              <T style={{ fontSize: 22 }}>{emoji}</T>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <T v="h3" style={{ fontSize: 17 }}>{name}</T>
                {popular ? <Pill bg={t.acc} color={t.onAcc} emoji="⭐">Most popular</Pill> : null}
              </View>
              <T v="small" muted>{sub}</T>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <T v="h2">{price}</T>
              <T v="tiny" muted>{per}</T>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 6 }}>
            {feats.map(([e, label, off]) => (
              <View key={label} style={{ width: "50%", flexDirection: "row", alignItems: "center", gap: 6 }}>
                <T v="small">{e}</T>
                <T v="small" color={off ? t.muted : t.text} style={{ fontWeight: "700", textDecorationLine: off ? "line-through" : "none" }}>{label}</T>
              </View>
            ))}
          </View>
        </Glass>
      )}
    </Pressable>
  );
}
