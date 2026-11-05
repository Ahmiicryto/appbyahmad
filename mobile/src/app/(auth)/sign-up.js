import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { Button, Card, Checkbox, Emoji, Header, Rise, Screen, T } from "../../components/ui";
import { EmailField, PasswordField } from "../../components/AuthFields";
import { useApp, useTheme } from "../../lib/AppContext";
import { useAppConfig } from "../../lib/appConfig";
import { Legal } from "./welcome";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// 0-4: length, mixed case, numbers, symbols.
export function passwordScore(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return pw.length < 8 ? Math.min(s, 1) : Math.min(4, s);
}
const LEVELS = [
  ["🔐", "Use at least 8 characters"],
  ["😬", "Weak — add numbers or symbols"],
  ["🙂", "Okay — a bit longer is better"],
  ["👍", "Good password"],
  ["💪", "Strong password"]
];

export default function SignUp() {
  const t = useTheme();
  const { signIn } = useApp();
  const { config } = useAppConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const score = passwordScore(password);
  const emailOk = EMAIL.test(email.trim());
  const ready = emailOk && password.length >= 8 && score >= 2 && agree;
  const colors = [t.track, t.bad, t.c2, t.ink, t.good];

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await signIn("register", email.trim(), password);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  if (config.signupOpen === false) {
    return (
      <Screen>
        <Header title="" />
        <Card><T v="h2">🚧 Sign-ups are paused</T><T muted>We're not taking new accounts right now. Please check back soon.</T></Card>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Header title="" />
        <Rise style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T v="h1">Create your account</T>
            <Emoji e="✨" size={24} anim="pulse" />
          </View>
          <T muted>It takes less than a minute. Free to start, no card needed.</T>
        </Rise>

        <Rise delay={80} style={{ gap: 14 }}>
          <EmailField value={email} onChangeText={setEmail} valid={emailOk} error={error?.fields?.email?.[0]} />
          <View style={{ gap: 8 }}>
            <PasswordField value={password} onChangeText={setPassword} isNew error={error?.fields?.password?.[0]} onSubmitEditing={submit} />
            <View style={{ flexDirection: "row", gap: 6 }} accessible accessibilityLabel={`Password strength: ${LEVELS[score][1]}`}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: score >= i ? colors[score] : t.track }} />
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Emoji e={LEVELS[score][0]} size={15} anim={score === 4 ? "bob" : undefined} />
              <T v="small" color={score >= 3 ? t.good : t.muted} style={{ fontWeight: "700" }}>{LEVELS[score][1]}</T>
            </View>
          </View>

          <Checkbox checked={agree} onChange={setAgree}>
            <Legal inline />
          </Checkbox>

          {error && !error.fields ? <T color={t.bad} style={{ fontWeight: "700" }}>😕 {error.message}</T> : null}
          <Button title="Create account" emoji="🚀" onPress={submit} busy={busy} disabled={!ready} pulse={ready} />
          <Pressable onPress={() => router.replace("/sign-in")} accessibilityRole="button" style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
            <T v="small" muted>Already have an account? <T v="small" color={t.ink} style={{ fontWeight: "800" }}>Sign in</T></T>
          </Pressable>
          <T v="tiny" muted style={{ textAlign: "center", fontWeight: "600" }}>🔒 Encrypted. We never sell your data.</T>
        </Rise>
      </Screen>
    </KeyboardAvoidingView>
  );
}
