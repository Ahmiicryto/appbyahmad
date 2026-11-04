// Premium plans + Stripe Checkout.
//
// IMPORTANT: Apple (App Store Guideline 3.1.1) and Google Play require their own in-app purchase system for
// digital subscriptions in most regions. This Stripe web-checkout flow is for the web build and for regions /
// storefronts where external payment links are allowed. Native in-app purchases (via RevenueCat) come later;
// before shipping to the stores, gate this screen's purchase button by platform/region accordingly.
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, ErrorBox, Loading, Overline, Rise, Screen, T } from "../components/ui";
import { api } from "../lib/api";
import { useApp, useTheme } from "../lib/AppContext";
import { useLoad } from "../lib/useLoad";

const money = (cents, currency = "usd") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
};

export default function Premium() {
  const t = useTheme();
  const { user } = useApp();
  const { data, error, loading, reload } = useLoad("/billing/plans");
  // AppContext has no refresh, so the screen keeps its own copy of the premium flag after checkout.
  const [premium, setPremium] = useState(Boolean(user?.isPremium));
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [message, setMessage] = useState(null);

  // Yearly first: it's the better deal.
  const plans = useMemo(
    () => [...(data?.plans ?? [])].sort((a, b) => (a.interval === b.interval ? 0 : a.interval === "year" ? -1 : 1)),
    [data]
  );
  const plan = plans.find((p) => p.id === selected) ?? plans[0];

  async function refreshMe() {
    try {
      const me = await api("/auth/me");
      setPremium(Boolean(me.user?.isPremium));
    } catch {
      // Not critical: the message below still tells them what happens next.
    }
  }

  async function subscribe() {
    if (!plan) return;
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      const { url } = await api("/billing/checkout", { method: "POST", body: { plan_id: plan.id } });
      await WebBrowser.openBrowserAsync(url);
      await refreshMe();
      setMessage("If you completed payment, Premium will be active in a moment.");
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  async function manage() {
    setBusy(true);
    setActionError(null);
    try {
      const { url } = await api("/billing/portal", { method: "POST" });
      await WebBrowser.openBrowserAsync(url);
      await refreshMe();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Loading />;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
        <T color={t.ink} style={{ fontWeight: "700" }}>← Back</T>
      </Pressable>
      <Rise style={{ gap: 6 }}>
        <Overline>Premium</Overline>
        <T v="h1">{premium ? "You're on Premium" : "Go further with Premium"}</T>
        <T muted>{premium ? "Thanks for supporting the app. Every feature is unlocked." : "Unlimited goals, adaptive plans and every life area."}</T>
      </Rise>

      {error && !data ? <ErrorBox error={error} onRetry={reload} /> : null}

      {premium ? (
        <Rise delay={60} style={{ gap: 10 }}>
          <Button title="Manage subscription" variant="secondary" busy={busy} onPress={manage} />
          <T v="small" muted>Change plan, update your card or cancel. Opens in your browser.</T>
        </Rise>
      ) : data && !data.paymentsEnabled ? (
        <Rise delay={60}>
          <Card>
            <T v="h3">Premium purchases open soon.</T>
            <T muted>We'll let you know when you can upgrade.</T>
          </Card>
        </Rise>
      ) : plans.length ? (
        <>
          <Rise delay={60} style={{ gap: 10 }}>
            <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
              {plans.map((p) => {
                const sel = p.id === plan?.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelected(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    accessibilityLabel={`${p.name}, ${money(p.price_cents, p.currency)} per ${p.interval}`}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, borderWidth: 1.5, borderColor: sel ? t.ink : t.line, backgroundColor: sel ? t.soft : t.s1 }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: sel ? t.ink : t.line, alignItems: "center", justifyContent: "center" }}>
                      {sel && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.ink }} />}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="h3">{p.name}</T>
                      {p.description ? <T v="small" muted>{p.description}</T> : null}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <T v="h3">{money(p.price_cents, p.currency)}</T>
                      <T v="small" muted>{p.interval === "year" ? `${money(Math.round(p.price_cents / 12), p.currency)}/mo` : "per month"}</T>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Rise>

          {plan?.features?.length ? (
            <Rise delay={120}>
              <Card>
                <T v="h3">What you get</T>
                {plan.features.map((f) => (
                  <View key={f} style={{ flexDirection: "row", gap: 10 }}>
                    <T color={t.ink} style={{ fontWeight: "800" }}>✓</T>
                    <T style={{ flex: 1 }}>{f}</T>
                  </View>
                ))}
              </Card>
            </Rise>
          ) : null}

          <Rise delay={180} style={{ gap: 8 }}>
            <Button
              title={plan?.trial_days > 0 ? `Start ${plan.trial_days}-day free trial` : "Subscribe"}
              pulse
              busy={busy}
              onPress={subscribe}
            />
            {plan ? (
              <T v="small" muted style={{ textAlign: "center" }}>
                {plan.trial_days > 0 ? `Free for ${plan.trial_days} days, then ` : ""}
                {money(plan.price_cents, plan.currency)} per {plan.interval}. Cancel anytime. Payment opens in your browser.
              </T>
            ) : null}
          </Rise>
        </>
      ) : data ? (
        <Card>
          <T muted>No plans are available right now. Check back soon.</T>
        </Card>
      ) : null}

      {message ? (
        <Card highlight={t.ink}>
          <T style={{ fontWeight: "700" }}>{message}</T>
        </Card>
      ) : null}
      {actionError ? <ErrorBox error={actionError} /> : null}
    </Screen>
  );
}
