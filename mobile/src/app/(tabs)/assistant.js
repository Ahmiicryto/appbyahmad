import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AiError } from "../../components/AiCard";
import { Icon } from "../../components/icons";
import { Card, Glass, GlassBackground, T, TAB_BAR_SPACE, Tap } from "../../components/ui";
import { api } from "../../lib/api";
import { useApp, useTheme } from "../../lib/AppContext";
import { useAppConfig } from "../../lib/appConfig";
import { confirm } from "../../lib/confirm";

const STARTERS = [
  "What should I focus on today?",
  "Am I on track with my goals this week?",
  "I only have 30 minutes. What's the best use of it?",
  "Help me break my biggest goal into steps."
];

export default function Assistant() {
  const t = useTheme();
  const { profile } = useApp();
  const { config } = useAppConfig();
  const [messages, setMessages] = useState(null);
  const [usage, setUsage] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const scroll = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await api("/ai/chat");
      setMessages(r.messages);
      setUsage(r.usage);
    } catch (err) {
      setMessages([]);
      setError(err);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function send(body = text) {
    const msg = body.trim();
    if (!msg || sending) return;
    setText("");
    setError(null);
    setSending(true);
    setMessages((m) => [...(m ?? []), { id: `local-${Date.now()}`, role: "user", content: msg }]);
    try {
      const r = await api("/ai/chat", { method: "POST", body: { text: msg } });
      setMessages((m) => [...m, r.message]);
      setUsage(r.usage);
      setNotice(r.notice || null);
    } catch (err) {
      setError(err);
      setMessages((m) => m.slice(0, -1));
      setText(msg);
    } finally {
      setSending(false);
    }
  }

  async function clear() {
    if (!(await confirm("Clear this conversation?", "The coach will forget this chat. Your goals and tasks stay as they are.", "Clear"))) return;
    await api("/ai/chat", { method: "DELETE" }).catch(() => {});
    setMessages([]);
  }

  if (config.features?.assistant === false) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <GlassBackground />
        <SafeAreaView edges={["top"]} style={{ flex: 1, padding: 18, gap: 12 }}>
          <T v="h1">Coach</T>
          <Card><T v="h3">Coming soon</T><T muted>Your AI coach isn't available yet. We'll let you know when it's ready.</T></Card>
        </SafeAreaView>
      </View>
    );
  }

  const empty = messages && messages.length === 0;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <GlassBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10, gap: 10 }}>
            <View style={{ flex: 1 }}>
              <T v="h1">Coach</T>
              <T v="small" muted>Knows your goals, tasks and how your week is going.</T>
            </View>
            {messages?.length ? (
              <Tap onPress={clear} accessibilityRole="button" accessibilityLabel="Clear conversation" hitSlop={8}>
                <Glass radius={12} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Icon name="refresh" color={t.text} size={18} /></Glass>
              </Tap>
            ) : null}
          </View>

          <ScrollView
            ref={scroll}
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 16, gap: 10, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!messages && <ActivityIndicator color={t.ink} style={{ marginTop: 40 }} />}
            {empty && (
              <View style={{ flex: 1, justifyContent: "flex-end", gap: 10 }}>
                <View style={{ alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.acc, borderWidth: 1, borderColor: t.pbd, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="sparkles" color={t.onAcc} size={26} />
                  </View>
                  <T v="h2" style={{ textAlign: "center" }}>{profile?.name ? `How can I help, ${profile.name.split(" ")[0]}?` : "How can I help?"}</T>
                  <T v="small" muted style={{ textAlign: "center", maxWidth: 290, lineHeight: 19 }}>Ask about your goals, your week, or what to do next. Answers are based on your own data.</T>
                </View>
                {STARTERS.map((s) => (
                  <Tap key={s} onPress={() => send(s)} accessibilityRole="button">
                    {({ pressed }) => (
                      <Glass radius={16} style={{ paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.85 : 1 }}>
                        <T v="small" style={{ flex: 1, fontWeight: "600" }}>{s}</T>
                        <Icon name="send" color={t.muted} size={15} />
                      </Glass>
                    )}
                  </Tap>
                ))}
              </View>
            )}
            {messages?.map((m) => <Bubble key={m.id} m={m} />)}
            {sending && (
              <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
                <ActivityIndicator size="small" color={t.ink} />
                <T v="small" muted>Coach is thinking…</T>
              </View>
            )}
            {error ? <Card highlight={t.line}><AiError error={error} /></Card> : null}
            {notice ? <T v="tiny" muted style={{ textAlign: "center", fontWeight: "500" }}>{notice}</T> : null}
          </ScrollView>

          <View style={{ paddingHorizontal: 14, paddingBottom: TAB_BAR_SPACE - 18, paddingTop: 6 }}>
            <Glass radius={22} strong style={{ flexDirection: "row", alignItems: "flex-end", paddingLeft: 16, paddingRight: 6, paddingVertical: 6, gap: 8 }}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Ask your coach…"
                placeholderTextColor={t.muted}
                multiline
                maxLength={2000}
                accessibilityLabel="Message to your coach"
                style={[{ flex: 1, minHeight: 40, maxHeight: 120, color: t.text, fontSize: 16, paddingTop: 10, paddingBottom: 10 }, Platform.OS === "web" && { outlineStyle: "none" }]}
              />
              <Tap onPress={() => send()} disabled={!text.trim() || sending} accessibilityRole="button" accessibilityLabel="Send"
                style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: text.trim() && !sending ? t.acc : t.track, alignItems: "center", justifyContent: "center" }}>
                <Icon name="arrowUp" color={text.trim() && !sending ? t.onAcc : t.muted} size={18} strokeWidth={2.2} />
              </Tap>
            </Glass>
            {usage && usage.limit <= 50 ? (
              <T v="tiny" muted style={{ textAlign: "center", marginTop: 6, fontWeight: "500" }}>{usage.remaining} of {usage.limit} AI requests left today</T>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Bubble({ m }) {
  const t = useTheme();
  const mine = m.role === "user";
  if (mine) {
    return (
      <View style={{ alignSelf: "flex-end", maxWidth: "84%", backgroundColor: t.acc, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: t.pbd }}>
        <T color={t.onAcc} style={{ lineHeight: 22 }}>{m.content}</T>
      </View>
    );
  }
  return (
    <Glass radius={20} style={{ alignSelf: "flex-start", maxWidth: "90%", borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 11 }}>
      <Formatted text={m.content} />
    </Glass>
  );
}

// Minimal formatting for coach replies: paragraphs, "- " bullets, "1." steps and **bold**.
function Formatted({ text }) {
  const t = useTheme();
  const lines = String(text).split("\n");
  const inline = (s, key) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <T key={`${key}-${i}`} style={{ fontWeight: "700", lineHeight: 22 }}>{part.slice(2, -2)}</T> : part
    );
  return (
    <View style={{ gap: 6 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;
        const bullet = line.match(/^\s*[-*•]\s+(.*)/);
        const step = line.match(/^\s*(\d+)[.)]\s+(.*)/);
        if (bullet || step) {
          return (
            <View key={i} style={{ flexDirection: "row", gap: 8 }}>
              <T color={t.ink} style={{ fontWeight: "700", lineHeight: 22, minWidth: 14 }}>{step ? `${step[1]}.` : "•"}</T>
              <T style={{ flex: 1, lineHeight: 22 }}>{inline(step ? step[2] : bullet[1], i)}</T>
            </View>
          );
        }
        const heading = line.match(/^#{1,4}\s+(.*)/);
        if (heading) return <T key={i} v="h3">{heading[1]}</T>;
        return <T key={i} style={{ lineHeight: 22 }}>{inline(line, i)}</T>;
      })}
    </View>
  );
}
