import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useTheme } from "../lib/AppContext";
import { Field, T } from "./ui";

export function EmailField({ valid, ...props }) {
  return (
    <Field
      label="Email"
      emoji="✉️"
      placeholder="you@example.com"
      autoCapitalize="none"
      autoComplete="email"
      autoCorrect={false}
      keyboardType="email-address"
      textContentType="emailAddress"
      returnKeyType="next"
      valid={valid}
      right={valid ? <Text accessibilityLabel="Email looks good" style={{ fontSize: 15 }}>✅</Text> : null}
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
      emoji="🔑"
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
