import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, TextInput, View } from "react-native";
import { Bar, Button, Card, Chevron, ErrorBox, Field, Header, Icon3D, IconButton, Loading, Rise, Screen, SectionTitle, Segmented, T, Tap } from "../components/ui";
import { api } from "../lib/api";
import { useTheme } from "../lib/AppContext";
import { confirm } from "../lib/confirm";
import { useLoad } from "../lib/useLoad";

const CAT = {
  food: { icon: "utensils", tone: "orange", label: "Food" },
  transport: { icon: "car", tone: "blue", label: "Transport" },
  shopping: { icon: "cart", tone: "pink", label: "Shopping" },
  bills: { icon: "receipt", tone: "slate", label: "Bills" },
  health: { icon: "heart", tone: "red", label: "Health" },
  fun: { icon: "music", tone: "violet", label: "Fun" },
  education: { icon: "book", tone: "indigo", label: "Education" },
  home: { icon: "home", tone: "cyan", label: "Home" },
  salary: { icon: "briefcase", tone: "green", label: "Salary" },
  business: { icon: "rocket", tone: "green", label: "Business" },
  freelance: { icon: "pencil", tone: "lime", label: "Freelance" },
  gift: { icon: "gift", tone: "amber", label: "Gift" },
  other: { icon: "coins", tone: "amber", label: "Other" }
};

const shiftMonth = (m, by) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

export default function Money() {
  const t = useTheme();
  const [month, setMonth] = useState(null);
  const { data, error, loading, reload, setData } = useLoad(`/money${month ? `?month=${month}` : ""}`);
  const [adding, setAdding] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);

  if (loading && !data) return <Loading />;
  if (!data) return <Screen><Header title="Money" /><ErrorBox error={error} onRetry={reload} /></Screen>;

  const fmt = (cents, opts = {}) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: data.currency, maximumFractionDigits: cents % 100 ? 2 : 0, ...opts }).format(cents / 100);
    } catch {
      return `${(cents / 100).toFixed(2)} ${data.currency}`;
    }
  };
  const label = new Date(`${data.month}-15T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const used = data.budget_cents ? Math.min(100, Math.round((data.expense_cents / Math.max(1, data.budget_cents)) * 100)) : 0;
  const groups = [];
  for (const tx of data.transactions) {
    const g = groups[groups.length - 1];
    if (g && g.day === tx.day) g.items.push(tx);
    else groups.push({ day: tx.day, items: [tx] });
  }

  async function remove(tx) {
    if (!(await confirm("Delete this entry?", `${CAT[tx.category]?.label ?? tx.category} · ${fmt(tx.amount_cents)}`, "Delete"))) return;
    try {
      const r = await api(`/money/transactions/${tx.id}`, { method: "DELETE" });
      setData(() => r);
    } catch {
      reload();
    }
  }

  return (
    <Screen footer={<View style={{ paddingHorizontal: 16, paddingBottom: 10 }}><Button title="Add entry" icon="plus" onPress={() => setAdding(true)} /></View>}>
      <Header title="Money" />

      <Rise style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton label="Previous month" onPress={() => setMonth(shiftMonth(data.month, -1))}><Chevron color={t.text} dir="left" size={18} /></IconButton>
        <T v="h3">{label}</T>
        <IconButton label="Next month" onPress={() => setMonth(shiftMonth(data.month, 1))}><Chevron color={t.text} dir="right" size={18} /></IconButton>
      </Rise>

      <Rise delay={40}>
        <Card style={{ gap: 12 }}>
          <View>
            <T v="tiny" muted style={{ letterSpacing: 1.2 }}>BALANCE THIS MONTH</T>
            <T v="display" color={data.net_cents < 0 ? t.bad : t.text}>{fmt(data.net_cents)}</T>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Mini icon="trend" tone="green" label="Income" value={fmt(data.income_cents)} />
            <Mini icon="cart" tone="red" label="Spent" value={fmt(data.expense_cents)} />
          </View>
          <Tap onPress={() => setBudgetOpen(true)} accessibilityRole="button" accessibilityLabel="Set monthly budget">
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <T v="small" muted style={{ fontWeight: "600" }}>{data.budget_cents ? `Budget ${fmt(data.budget_cents)}` : "Set a monthly budget"}</T>
                <T v="small" color={data.budget_left_cents < 0 ? t.bad : t.ink} style={{ fontWeight: "700" }}>
                  {data.budget_cents ? (data.budget_left_cents < 0 ? `${fmt(-data.budget_left_cents)} over` : `${fmt(data.budget_left_cents)} left`) : "Set"}
                </T>
              </View>
              {data.budget_cents ? <Bar value={used} height={6} color={used >= 100 ? t.bad : used >= 80 ? t.c2 : t.good} delay={150} /> : null}
            </View>
          </Tap>
        </Card>
      </Rise>

      {data.by_category.length > 0 && (
        <Rise delay={80}>
          <SectionTitle title="Spending by category" />
          <Card style={{ marginTop: 8, gap: 10 }}>
            {data.by_category.map((c, i) => (
              <View key={c.category} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon3D name={CAT[c.category]?.icon ?? "coins"} tone={CAT[c.category]?.tone} size={30} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <T v="small" style={{ fontWeight: "600" }}>{CAT[c.category]?.label ?? c.category}</T>
                    <T v="small" style={{ fontWeight: "700" }}>{fmt(c.cents)}</T>
                  </View>
                  <Bar value={(c.cents / Math.max(1, data.expense_cents)) * 100} height={4} delay={150 + i * 50} color={t.ink} />
                </View>
              </View>
            ))}
          </Card>
        </Rise>
      )}

      <Rise delay={120}>
        <SectionTitle title="Transactions" />
      </Rise>
      {groups.length === 0 && <T v="small" muted>No entries this month. Add your first one below.</T>}
      {groups.map((g) => (
        <View key={g.day} style={{ gap: 6 }}>
          <T v="tiny" muted style={{ fontWeight: "700" }}>{new Date(`${g.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</T>
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {g.items.map((tx, i) => (
              <Tap key={tx.id} onLongPress={() => remove(tx)} onPress={() => remove(tx)} accessibilityRole="button" accessibilityLabel={`${CAT[tx.category]?.label}, ${fmt(tx.amount_cents)}. Tap to delete.`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: i === g.items.length - 1 ? 0 : 0.5, borderColor: t.line }}>
                  <Icon3D name={CAT[tx.category]?.icon ?? "coins"} tone={CAT[tx.category]?.tone} size={32} />
                  <View style={{ flex: 1 }}>
                    <T v="small" style={{ fontWeight: "600" }} numberOfLines={1}>{tx.note || CAT[tx.category]?.label}</T>
                    <T v="tiny" muted>{CAT[tx.category]?.label}</T>
                  </View>
                  <T v="small" color={tx.kind === "income" ? t.good : t.text} style={{ fontWeight: "700" }}>{tx.kind === "income" ? "+" : "−"}{fmt(tx.amount_cents)}</T>
                </View>
              </Tap>
            ))}
          </Card>
        </View>
      ))}

      <AddSheet open={adding} currency={data.currency} categories={data.categories} onClose={() => setAdding(false)} onSaved={(r) => { setMonth(r.month); setData(() => r); setAdding(false); }} />
      <BudgetSheet open={budgetOpen} current={data.budget_cents} currency={data.currency} onClose={() => setBudgetOpen(false)} onSaved={(r) => { setData(() => r); setBudgetOpen(false); }} />
    </Screen>
  );
}

function Mini({ icon, tone, label, value }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 14, backgroundColor: t.s2 }}>
      <Icon3D name={icon} tone={tone} size={30} />
      <View style={{ flex: 1 }}>
        <T v="tiny" muted>{label}</T>
        <T v="small" style={{ fontWeight: "700" }} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
      </View>
    </View>
  );
}

// Parses "12.50" or "1,200" into cents.
const toCents = (s) => {
  const n = Number(String(s).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

function Sheet({ open, onClose, children }) {
  const t = useTheme();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Tap guard={0} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} accessibilityLabel="Close" />
        <View style={{ marginHorizontal: 10, marginBottom: 18, borderRadius: 24, padding: 16, gap: 12, backgroundColor: t.solid, borderWidth: 1, borderColor: t.line }}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddSheet({ open, currency, categories, onClose, onSaved }) {
  const t = useTheme();
  const [kind, setKind] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const cats = categories?.[kind] ?? [];
  const cents = toCents(amount);

  async function save() {
    setError(null);
    try {
      const r = await api("/money/transactions", { method: "POST", body: { kind, amount_cents: cents, category: cats.includes(category) ? category : cats[0], note: note.trim() || null } });
      setAmount("");
      setNote("");
      onSaved(r);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <Segmented label="Type" value={kind} onChange={(k) => { setKind(k); setCategory(k === "income" ? "salary" : "food"); }} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <T v="h2" muted>{currency}</T>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor={t.muted}
          keyboardType="decimal-pad"
          autoFocus
          accessibilityLabel="Amount"
          style={[{ fontSize: 40, fontWeight: "800", color: t.text, minWidth: 120, textAlign: "center" }, Platform.OS === "web" && { outlineStyle: "none" }]}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {cats.map((c) => {
          const sel = c === category;
          return (
            <Tap key={c} guard={150} onPress={() => setCategory(c)} accessibilityRole="radio" accessibilityState={{ checked: sel }} accessibilityLabel={CAT[c]?.label ?? c}>
              <View style={{ width: 70, alignItems: "center", gap: 5, paddingVertical: 8, borderRadius: 14, backgroundColor: sel ? t.soft : t.s2, borderWidth: 1.5, borderColor: sel ? t.ink : "transparent" }}>
                <Icon3D name={CAT[c]?.icon ?? "coins"} tone={CAT[c]?.tone} size={32} />
                <T v="tiny" style={{ fontWeight: "600" }} numberOfLines={1}>{CAT[c]?.label ?? c}</T>
              </View>
            </Tap>
          );
        })}
      </ScrollView>
      <Field icon="pencil" placeholder="Note (optional)" value={note} onChangeText={setNote} maxLength={120} accessibilityLabel="Note" />
      {error ? <T v="small" color={t.bad}>{error}</T> : null}
      <Button title={`Add ${kind}`} disabled={cents <= 0} onPress={save} />
    </Sheet>
  );
}

function BudgetSheet({ open, current, currency, onClose, onSaved }) {
  const t = useTheme();
  const [value, setValue] = useState("");
  const [error, setError] = useState(null);
  async function save(clear) {
    setError(null);
    try {
      onSaved(await api("/money/budget", { method: "PUT", body: { budget_cents: clear ? null : toCents(value) } }));
      setValue("");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Sheet open={open} onClose={onClose}>
      <T v="h2">Monthly budget</T>
      <T v="small" muted>How much do you want to spend at most each month?</T>
      <Field icon="wallet" placeholder={current ? String(current / 100) : `Amount in ${currency}`} value={value} onChangeText={setValue} keyboardType="decimal-pad" accessibilityLabel="Monthly budget" />
      {error ? <T v="small" color={t.bad}>{error}</T> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {current ? <Button style={{ flex: 1 }} small variant="secondary" title="Remove" onPress={() => save(true)} /> : null}
        <Button style={{ flex: 1.4 }} small title="Save budget" disabled={toCents(value) <= 0} onPress={() => save(false)} />
      </View>
    </Sheet>
  );
}
