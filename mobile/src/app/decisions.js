import { useMemo, useState } from "react";
import { View } from "react-native";
import { Icon } from "../components/icons";
import { Bar, Button, Card, Field, Header, Icon3D, IconButton, Rise, Screen, SectionTitle, T, Tap } from "../components/ui";
import { useTheme } from "../lib/AppContext";
import { go } from "../lib/nav";

const EXAMPLE = {
  question: "Should I take the new job?",
  options: ["Stay", "New job"],
  criteria: [{ name: "Salary", weight: 3 }, { name: "Growth", weight: 3 }, { name: "Work-life balance", weight: 2 }]
};

// Weighted decision matrix: score each option 1–5 on what matters; weights decide the winner.
export default function Decisions() {
  const t = useTheme();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [criteria, setCriteria] = useState([{ name: "", weight: 2 }]);
  const [scores, setScores] = useState({}); // `${option}|${criterion}` → 1..5

  const opts = options.map((o, i) => o.trim() || `Option ${i + 1}`);
  const crit = criteria.filter((c) => c.name.trim());
  const results = useMemo(() => {
    const maxWeight = crit.reduce((s, c) => s + c.weight * 5, 0) || 1;
    return opts
      .map((o, i) => ({ i, name: o, score: crit.reduce((s, c, ci) => s + c.weight * (scores[`${i}|${ci}`] ?? 3), 0) / maxWeight }))
      .sort((a, b) => b.score - a.score);
  }, [opts.join(), JSON.stringify(crit), scores]); // eslint-disable-line react-hooks/exhaustive-deps

  const setOpt = (i, v) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const setCrit = (i, patch) => setCriteria((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const loadExample = () => {
    setQuestion(EXAMPLE.question);
    setOptions(EXAMPLE.options);
    setCriteria(EXAMPLE.criteria);
    setScores({ "0|0": 3, "1|0": 5, "0|1": 2, "1|1": 4, "0|2": 4, "1|2": 3 });
  };
  const reset = () => {
    setQuestion("");
    setOptions(["", ""]);
    setCriteria([{ name: "", weight: 2 }]);
    setScores({});
  };
  const winner = results[0];
  const close = results.length > 1 && winner.score - results[1].score < 0.05;

  return (
    <Screen>
      <Header title="Decisions" right={<IconButton label="Start over" onPress={reset}><Icon name="refresh" color={t.text} size={17} /></IconButton>} />
      <Rise>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon3D name="scale" tone="orange" size={44} />
          <View style={{ flex: 1 }}>
            <T v="h3">Decide with clarity</T>
            <T v="tiny" muted style={{ fontWeight: "500" }}>List your options and what matters, then score each one.</T>
          </View>
        </Card>
      </Rise>
      <Field icon="help" placeholder="What are you deciding?" value={question} onChangeText={setQuestion} maxLength={100} accessibilityLabel="Decision question" />
      {!question && <Tap onPress={loadExample} accessibilityRole="button"><T v="small" color={t.ink} style={{ fontWeight: "700" }}>Try an example</T></Tap>}

      <SectionTitle title="Options" action={options.length < 4 ? "Add option" : null} onAction={() => setOptions((o) => [...o, ""])} />
      {options.map((o, i) => (
        <Field key={i} placeholder={`Option ${i + 1}`} value={o} onChangeText={(v) => setOpt(i, v)} maxLength={40} accessibilityLabel={`Option ${i + 1}`}
          right={options.length > 2 ? <Tap onPress={() => setOptions((x) => x.filter((_, j) => j !== i))} accessibilityLabel="Remove option" hitSlop={8}><Icon name="x" color={t.muted} size={16} /></Tap> : null} />
      ))}

      <SectionTitle title="What matters" action={criteria.length < 6 ? "Add" : null} onAction={() => setCriteria((c) => [...c, { name: "", weight: 2 }])} />
      {criteria.map((c, i) => (
        <Card key={i} style={{ gap: 8 }}>
          <Field placeholder="e.g. Salary, Location, Happiness" value={c.name} onChangeText={(v) => setCrit(i, { name: v })} maxLength={40} accessibilityLabel={`What matters ${i + 1}`}
            right={criteria.length > 1 ? <Tap onPress={() => setCriteria((x) => x.filter((_, j) => j !== i))} accessibilityLabel="Remove" hitSlop={8}><Icon name="x" color={t.muted} size={16} /></Tap> : null} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T v="tiny" muted style={{ width: 70 }}>Importance</T>
            {[1, 2, 3].map((w) => (
              <Tap key={w} guard={120} onPress={() => setCrit(i, { weight: w })} style={{ flex: 1 }} accessibilityRole="radio" accessibilityState={{ checked: c.weight === w }}>
                <View style={{ height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: c.weight === w ? t.acc : t.s2 }}>
                  <T v="tiny" color={c.weight === w ? t.onAcc : t.text} style={{ fontWeight: "700" }}>{["Low", "Medium", "High"][w - 1]}</T>
                </View>
              </Tap>
            ))}
          </View>
          {c.name.trim() ? opts.map((o, oi) => {
            const key = `${oi}|${crit.indexOf(c)}`;
            const val = scores[key] ?? 3;
            return (
              <View key={oi} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <T v="tiny" style={{ width: 70, fontWeight: "600" }} numberOfLines={1}>{o}</T>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Tap key={n} guard={100} onPress={() => setScores((s) => ({ ...s, [key]: n }))} style={{ flex: 1 }} accessibilityLabel={`${o} ${c.name} ${n} of 5`}>
                    <View style={{ height: 26, borderRadius: 8, backgroundColor: n <= val ? t.ink : t.track, opacity: n <= val ? 0.35 + n * 0.13 : 1 }} />
                  </Tap>
                ))}
              </View>
            );
          }) : null}
        </Card>
      ))}

      {crit.length > 0 && (
        <Rise>
          <Card highlight={t.pbd} style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon3D name="trophy" tone="amber" size={38} />
              <View style={{ flex: 1 }}>
                <T v="tiny" muted style={{ letterSpacing: 1 }}>{close ? "TOO CLOSE TO CALL" : "BEST FIT"}</T>
                <T v="h2">{close ? `${results[0].name} ≈ ${results[1].name}` : winner.name}</T>
              </View>
            </View>
            {results.map((r) => (
              <View key={r.i} style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <T v="small" style={{ fontWeight: "600" }}>{r.name}</T>
                  <T v="small" style={{ fontWeight: "700" }}>{Math.round(r.score * 100)}%</T>
                </View>
                <Bar value={r.score * 100} height={6} delay={0} color={r.i === winner.i ? t.ink : t.muted} />
              </View>
            ))}
            {close && <T v="tiny" muted style={{ fontWeight: "500" }}>When it's this close, go with the option that excites you more.</T>}
            <Button small variant="secondary" icon="sparkles" title="Ask the coach about this" onPress={() => go("/assistant")} />
          </Card>
        </Rise>
      )}
    </Screen>
  );
}
