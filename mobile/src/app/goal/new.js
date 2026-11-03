import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { Button, Chip, Field, Overline, Ring, Rise, Screen, T } from "../../components/ui";
import { api } from "../../lib/api";
import { useTheme } from "../../lib/AppContext";

const EXAMPLES = ["Lose 15 kg", "Save $20,000", "Start a business", "Get a new job", "Read 20 books", "Learn a skill"];

export default function NewGoal() {
  const t = useTheme();
  const [f, setF] = useState({ title: "", current_situation: "", target: "", deadline: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  async function create() {
    setBusy(true);
    setError(null);
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    try {
      const r = await api("/goals", { method: "POST", body });
      router.replace(`/goal/${r.goal.id}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
          <Ring size={120} value={100} label="Building your plan">
            <T v="h3">…</T>
          </Ring>
          <T v="h2" style={{ textAlign: "center" }}>Building your plan</T>
          <T muted style={{ textAlign: "center" }}>Milestones, this week's tasks and your first step for today.</T>
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
          <T color={t.ink} style={{ fontWeight: "700" }}>Cancel</T>
        </Pressable>
        <Rise style={{ gap: 6 }}>
          <Overline>New goal</Overline>
          <T v="h1">What is your goal?</T>
        </Rise>
        <Rise delay={60} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {EXAMPLES.map((e) => (
            <Chip key={e} label={e} selected={f.title === e} onPress={() => set("title")(e)} accessibilityRole="button" />
          ))}
        </Rise>
        <Rise delay={120} style={{ gap: 14 }}>
          <Field label="Your goal" value={f.title} onChangeText={set("title")} placeholder="Start a business making $10,000/month" error={error?.fields?.title?.[0]} />
          <Field label="Where are you now? (optional)" value={f.current_situation} onChangeText={set("current_situation")} placeholder="I have an idea but no customers yet" multiline />
          <Field label="Target (optional)" value={f.target} onChangeText={set("target")} placeholder="$10,000 a month" />
          <Field label="Deadline, YYYY-MM-DD (optional)" value={f.deadline} onChangeText={set("deadline")} placeholder="2027-06-30" keyboardType="numbers-and-punctuation" error={error?.fields?.deadline?.[0]} />
          <Field label="Why does this matter to you? (optional)" value={f.reason} onChangeText={set("reason")} placeholder="I want more freedom with my time" multiline />
        </Rise>
        {error && !error.fields ? (
          <View style={{ gap: 10 }}>
            <T color={t.bad} style={{ fontWeight: "700" }}>{error.message}</T>
            {error.code === "goal_limit" && <Button title="See Premium" variant="secondary" onPress={() => router.replace("/settings")} />}
          </View>
        ) : null}
        <Button title="Create my plan" pulse disabled={f.title.trim().length < 3} onPress={create} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
