import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Button, Card, Field, Overline, Ring, Rise, Screen, T } from "../components/ui";
import { useApp, useTheme } from "../lib/AppContext";
import { THEMES } from "../theme/themes";

const GENDERS = [
  { gender: "male", theme: "male", label: "Male" },
  { gender: "female", theme: "female", label: "Female" },
  { gender: "unspecified", theme: "neutral", label: "Prefer not to answer" }
];
const STEPS = 4;

export default function Onboarding() {
  const { updateProfile, setPreviewTheme, themeKey } = useApp();
  const t = useTheme();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [f, setF] = useState({ name: "", gender: null, birth_date: "", height_cm: "", weight_kg: "", occupation: "", self_word: "", aspiration: "" });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const canNext = [f.name.trim().length > 0, Boolean(f.gender), true, true][step];

  async function finish() {
    setBusy(true);
    setError(null);
    const num = (v) => (v === "" ? null : Number(String(v).replace(",", ".")));
    try {
      await updateProfile({
        name: f.name.trim(),
        gender: f.gender,
        theme: themeKey,
        birth_date: /^\d{4}-\d{2}-\d{2}$/.test(f.birth_date) ? f.birth_date : null,
        height_cm: num(f.height_cm),
        weight_kg: num(f.weight_kg),
        occupation: f.occupation.trim() || null,
        self_word: f.self_word.trim() || null,
        aspiration: f.aspiration.trim() || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        complete_onboarding: true
      });
      setPreviewTheme(null);
    } catch (err) {
      setError(err.fields ? "Check the highlighted answers and try again." : err.message);
      setBusy(false);
    }
  }

  const next = () => (step < STEPS - 1 ? setStep(step + 1) : finish());

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }} accessible accessibilityLabel={`Step ${step + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? t.ink : t.track }} />
          ))}
          <T v="small" muted style={{ marginLeft: 8 }}>{step + 1} of {STEPS}</T>
        </View>

        {step === 0 && (
          <Rise key="s0" style={{ gap: 14 }}>
            <Overline>Tell us about you</Overline>
            <T v="h1">What should we call you?</T>
            <Field label="Your name" value={f.name} onChangeText={set("name")} autoFocus autoComplete="name" textContentType="givenName" onSubmitEditing={() => canNext && next()} />
          </Rise>
        )}

        {step === 1 && (
          <Rise key="s1" style={{ gap: 12 }}>
            <Overline>Tell us about you</Overline>
            <T v="h1">Pick your look</T>
            <T muted>Your answer sets your starting theme. You can change it anytime in Settings.</T>
            <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
              {GENDERS.map((g, i) => {
                const th = THEMES[g.theme];
                const sel = f.gender === g.gender;
                return (
                  <Rise key={g.gender} delay={80 * i}>
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: sel }}
                      onPress={() => {
                        set("gender")(g.gender);
                        setPreviewTheme(g.theme);
                      }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 68, padding: 12, borderRadius: 18, borderWidth: 1.5, borderColor: sel ? t.ink : t.line, backgroundColor: sel ? t.soft : t.s1 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: th.bg, borderWidth: 1, borderColor: th.line, alignItems: "center", justifyContent: "center" }}>
                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: th.acc }} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <T v="h3">{g.label}</T>
                        <T v="small" muted>{th.name} theme</T>
                      </View>
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: sel ? t.acc : t.line, backgroundColor: sel ? t.acc : "transparent", alignItems: "center", justifyContent: "center" }}>
                        {sel && (
                          <Svg width={12} height={12} viewBox="0 0 24 24"><Path d="M5 12l5 5L20 7" stroke={t.onAcc} strokeWidth={4} fill="none" strokeLinecap="round" /></Svg>
                        )}
                      </View>
                    </Pressable>
                  </Rise>
                );
              })}
            </View>
            {f.gender && (
              <Rise key={themeKey}>
                <Card style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <Ring size={80} stroke={8} value={78} label="Life Score preview">
                    <T v="h3">782</T>
                  </Ring>
                  <View style={{ flex: 1, gap: 6 }}>
                    <T v="tiny" muted>LIVE PREVIEW</T>
                    <T v="small" style={{ fontWeight: "700" }}>{f.name ? `Good morning, ${f.name.trim()}` : "Good morning"}</T>
                    <T v="small" muted>Here's your day.</T>
                  </View>
                </Card>
              </Rise>
            )}
          </Rise>
        )}

        {step === 2 && (
          <Rise key="s2" style={{ gap: 14 }}>
            <Overline>Optional</Overline>
            <T v="h1">A few body basics</T>
            <T muted>Used for fitness and nutrition plans. You can skip this and add it later.</T>
            <Field label="Date of birth (YYYY-MM-DD)" value={f.birth_date} onChangeText={set("birth_date")} placeholder="1998-04-21" keyboardType="numbers-and-punctuation" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Field style={{ flex: 1 }} label="Height (cm)" value={f.height_cm} onChangeText={set("height_cm")} keyboardType="decimal-pad" placeholder="178" />
              <Field style={{ flex: 1 }} label="Weight (kg)" value={f.weight_kg} onChangeText={set("weight_kg")} keyboardType="decimal-pad" placeholder="82" />
            </View>
          </Rise>
        )}

        {step === 3 && (
          <Rise key="s3" style={{ gap: 14 }}>
            <Overline>Last step</Overline>
            <T v="h1">Where you are, and where you want to go</T>
            <Field label="What do you do for a living?" value={f.occupation} onChangeText={set("occupation")} placeholder="Designer" />
            <Field label="Describe yourself in one word" value={f.self_word} onChangeText={set("self_word")} placeholder="Driven" />
            <Field label="What do you want to become?" value={f.aspiration} onChangeText={set("aspiration")} placeholder="A founder with a profitable business" />
          </Rise>
        )}

        {error ? <T color={t.bad} style={{ fontWeight: "700" }}>{error}</T> : null}
        <View style={{ gap: 10, marginTop: 8 }}>
          <Button title={step === STEPS - 1 ? "Build my plan" : "Continue"} pulse={canNext} disabled={!canNext} busy={busy} onPress={next} />
          {step > 0 && <Button title="Back" variant="secondary" onPress={() => setStep(step - 1)} />}
          <T v="small" muted style={{ textAlign: "center" }}>We only use this to personalize your plan.</T>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
