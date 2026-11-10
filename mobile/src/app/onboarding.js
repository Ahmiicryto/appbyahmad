import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Button, Card, Field, Glass, Overline, Ring, Rise, Screen, Segmented, T, Tap } from "../components/ui";
import { useApp, useTheme } from "../lib/AppContext";

const GENDERS = [
  { gender: "male", theme: "male", label: "Male", sub: "Steel blue", sw: ["#8299B7", "#8299B7"] },
  { gender: "female", theme: "female", label: "Female", sub: "Plum", sw: ["#582C38", "#582C38"] },
  { gender: "unspecified", theme: "neutral", label: "Prefer not to say", sub: "Starts with steel blue", sw: ["#8299B7", "#582C38"] }
];
const APPEARANCES = [
  { value: "auto", label: "Auto", icon: "contrast" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" }
];
const STEPS = 4;

export default function Onboarding() {
  const { updateProfile, setPreviewTheme, setPreviewAppearance, themeKey, appearance } = useApp();
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
        appearance,
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
      setPreviewAppearance(null);
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
            <T v="h1">Make it yours</T>
            <T muted>Pick a color and how the app looks. You can change both anytime in Settings.</T>
            <Overline>Your color</Overline>
            <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
              {GENDERS.map((g, i) => {
                const sel = f.gender === g.gender;
                return (
                  <Rise key={g.gender} delay={70 * i}>
                    <Tap
                      accessibilityRole="radio"
                      accessibilityState={{ checked: sel }}
                      onPress={() => {
                        set("gender")(g.gender);
                        setPreviewTheme(g.theme);
                      }}
                    >
                      <Glass radius={20} border={sel ? t.ink : undefined} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, padding: 12, borderWidth: 1.5, backgroundColor: sel ? t.soft : t.s1 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 12, overflow: "hidden", flexDirection: "row", transform: [{ rotate: "45deg" }, { scale: 0.85 }] }}>
                          <View style={{ flex: 1, backgroundColor: g.sw[0] }} />
                          <View style={{ flex: 1, backgroundColor: g.sw[1] }} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <T v="h3">{g.label}</T>
                          <T v="small" muted>{g.sub}</T>
                        </View>
                        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: sel ? t.ink : t.muted, backgroundColor: sel ? t.acc : "transparent", alignItems: "center", justifyContent: "center" }}>
                          {sel && (
                            <Svg width={12} height={12} viewBox="0 0 24 24"><Path d="M5 12l5 5L20 7" stroke={t.onAcc} strokeWidth={4} fill="none" strokeLinecap="round" /></Svg>
                          )}
                        </View>
                      </Glass>
                    </Tap>
                  </Rise>
                );
              })}
            </View>
            <Overline>Appearance</Overline>
            <Segmented label="Appearance" value={appearance} onChange={setPreviewAppearance} options={APPEARANCES} />
            <T v="small" muted>Auto matches your phone's light or dark setting.</T>
            <Rise key={`${themeKey}-${t.mode}`}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <Ring size={72} stroke={8} value={78} label="Life Score preview">
                  <T v="h3">782</T>
                </Ring>
                <View style={{ flex: 1, gap: 4 }}>
                  <Overline>Live preview</Overline>
                  <T style={{ fontWeight: "800" }}>{f.name ? `Good morning, ${f.name.trim()}` : "Good morning"}</T>
                  <T v="small" muted>3 priorities waiting for you</T>
                </View>
              </Card>
            </Rise>
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
          <Button title={step === STEPS - 1 ? "Build my plan" : "Continue"} disabled={!canNext} busy={busy} onPress={next} />
          {step > 0 && <Button title="Back" variant="secondary" onPress={() => setStep(step - 1)} />}
          <T v="small" muted style={{ textAlign: "center" }}>We only use this to personalize your plan.</T>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
