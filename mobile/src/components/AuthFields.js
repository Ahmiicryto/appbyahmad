import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "../lib/AppContext";
import { Icon } from "./icons";
import { Field, T } from "./ui";

export function EmailField({ valid, ...props }) {
  const t = useTheme();
  return (
    <Field
      label="Email"
      icon="mail"
      placeholder="you@example.com"
      autoCapitalize="none"
      autoComplete="email"
      autoCorrect={false}
      keyboardType="email-address"
      textContentType="emailAddress"
      returnKeyType="next"
      valid={valid}
      right={valid ? <View accessible accessibilityLabel="Email looks good"><Icon name="check" color={t.good} size={18} strokeWidth={2.2} /></View> : null}
      {...props}
    />
  );
}

export function PasswordField({ isNew, ...props }) {
  const t = useTheme();
  const [show, setShow] = useState(false);
  return (
    <Field
      label="Password"
      icon="key"
      placeholder={isNew ? "At least 8 characters" : "Your password"}
      secureTextEntry={!show}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={isNew ? "new-password" : "current-password"}
      textContentType={isNew ? "newPassword" : "password"}
      returnKeyType="go"
      right={
        <Pressable onPress={() => setShow((s) => !s)} accessibilityRole="button" accessibilityLabel={show ? "Hide password" : "Show password"} hitSlop={10}>
          <T v="small" color={t.ink} style={{ fontWeight: "800" }}>{show ? "Hide" : "Show"}</T>
        </Pressable>
      }
      {...props}
    />
  );
}
