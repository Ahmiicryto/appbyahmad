import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { Button, Field, Rise, Screen, T } from "../../components/ui";
import { useApp, useTheme } from "../../lib/AppContext";

export default function SignIn() {
  const { mode: initial } = useLocalSearchParams();
  const [mode, setMode] = useState(initial === "login" ? "login" : "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { signIn } = useApp();
  const t = useTheme();
  const register = mode === "register";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(mode, email.trim(), password);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
          <T color={t.ink} style={{ fontWeight: "700" }}>← Back</T>
        </Pressable>
        <Rise style={{ gap: 6 }}>
          <T v="h1">{register ? "Create your account" : "Welcome back"}</T>
          <T muted>{register ? "It takes less than a minute." : "Sign in to see your day."}</T>
        </Rise>
        <Rise delay={100} style={{ gap: 14 }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            error={error?.fields?.email?.[0]}
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={register ? "new-password" : "current-password"}
            textContentType={register ? "newPassword" : "password"}
            placeholder={register ? "At least 8 characters" : undefined}
            error={error?.fields?.password?.[0]}
            onSubmitEditing={submit}
          />
          {error && !error.fields ? <T color={t.bad} style={{ fontWeight: "700" }}>{error.message}</T> : null}
          <Button title={register ? "Create account" : "Sign in"} onPress={submit} busy={busy} disabled={!email || !password} />
          <Pressable onPress={() => setMode(register ? "login" : "register")} accessibilityRole="button" style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
            <T v="small" muted>
              {register ? "Already have an account? " : "New here? "}
              <T v="small" color={t.ink} style={{ fontWeight: "800" }}>{register ? "Sign in" : "Create an account"}</T>
            </T>
          </Pressable>
        </Rise>
      </Screen>
    </KeyboardAvoidingView>
  );
}
