import { swap } from "../../lib/nav";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, View } from "react-native";
import { Button, Glass, Header, Rise, Screen, T, Tap, Toggle } from "../../components/ui";
import { EmailField, PasswordField } from "../../components/AuthFields";
import { useApp, useTheme } from "../../lib/AppContext";
import { useAppConfig } from "../../lib/appConfig";

export default function SignIn() {
  const t = useTheme();
  const { signIn } = useApp();
  const { config } = useAppConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn("login", email.trim(), password, { remember });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  function forgot() {
    const support = config.legal?.supportEmail;
    const msg = support
      ? `Email ${support} from the address you signed up with and we'll help you get back in.`
      : "Contact support from the address you signed up with and we'll help you get back in.";
    if (Platform.OS === "web") return window.alert(msg);
    Alert.alert("Forgot your password?", msg, support
      ? [{ text: "Cancel", style: "cancel" }, { text: "Email support", onPress: () => Linking.openURL(`mailto:${support}?subject=${encodeURIComponent("Reset my password")}`) }]
      : [{ text: "OK" }]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Header title="" />
        <Rise style={{ gap: 6 }}>
          <T v="h1">Welcome back</T>
          <T muted>Sign in to see your day.</T>
        </Rise>

        <Rise delay={80} style={{ gap: 14 }}>
          <EmailField value={email} onChangeText={setEmail} error={error?.fields?.email?.[0]} />
          <PasswordField value={password} onChangeText={setPassword} error={error?.fields?.password?.[0]} onSubmitEditing={submit} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Tap onPress={forgot} accessibilityRole="button" hitSlop={8}>
              <T v="small" color={t.ink} style={{ fontWeight: "800" }}>Forgot password?</T>
            </Tap>
          </View>

          <Glass radius={18} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: "800" }}>Keep me signed in</T>
              <T v="small" muted>Turn off on shared phones.</T>
            </View>
            <Toggle value={remember} onChange={setRemember} label="Keep me signed in" />
          </Glass>

          {error && !error.fields ? <T color={t.bad} style={{ fontWeight: "600" }}>{error.message}</T> : null}
          <Button title="Sign in" onPress={submit} busy={busy} disabled={!email.trim() || !password} />
          <Tap onPress={() => swap("/sign-up")} accessibilityRole="button" style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
            <T v="small" muted>New here? <T v="small" color={t.ink} style={{ fontWeight: "800" }}>Create an account</T></T>
          </Tap>
        </Rise>
      </Screen>
    </KeyboardAvoidingView>
  );
}
