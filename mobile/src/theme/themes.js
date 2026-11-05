// Glass design tokens. Two colour families × light/dark. "Auto" follows the phone's setting.
// Men: steel blue #8299B7. Women: plum #582C38. "Prefer not to say" starts with steel blue.
//
// Older keys (s1, s2, line, acc, onAcc) are kept so every screen keeps working:
//   s1 = glass fill, s2 = stronger glass, line = glass border, acc = primary, onAcc = text on primary.
const PALETTES = {
  men: {
    dark: {
      bg: "#0A0E15", blob1: "rgba(130,153,183,0.55)", blob2: "rgba(70,100,150,0.45)", blob3: "rgba(180,200,225,0.22)",
      s1: "rgba(255,255,255,0.06)", s2: "rgba(255,255,255,0.11)", line: "rgba(255,255,255,0.13)", hi: "rgba(255,255,255,0.18)",
      text: "#EEF2F8", muted: "#9DA9BB", acc: "#8299B7", onAcc: "#0A111C", ink: "#B3C5DE",
      soft: "rgba(130,153,183,0.20)", track: "rgba(255,255,255,0.10)", pbd: "rgba(178,197,222,0.5)", glow: "rgba(130,153,183,0.55)",
      c2: "#E8B86B", c3: "#7FC8B8", c4: "#C3A6E8", bad: "#F08A8A", good: "#7FC8B8", solid: "#121925"
    },
    light: {
      bg: "#EDF1F7", blob1: "rgba(130,153,183,0.60)", blob2: "rgba(160,190,230,0.55)", blob3: "rgba(220,200,235,0.45)",
      s1: "rgba(255,255,255,0.55)", s2: "rgba(255,255,255,0.78)", line: "rgba(255,255,255,0.85)", hi: "rgba(255,255,255,0.95)",
      text: "#0F1724", muted: "#4A5568", acc: "#8299B7", onAcc: "#0B1220", ink: "#41597D",
      soft: "rgba(130,153,183,0.24)", track: "rgba(15,23,36,0.09)", pbd: "rgba(65,89,125,0.25)", glow: "rgba(130,153,183,0.55)",
      c2: "#9A5F0E", c3: "#17705F", c4: "#6447A8", bad: "#B42318", good: "#17705F", solid: "#F7F9FC"
    }
  },
  women: {
    dark: {
      bg: "#0F0709", blob1: "rgba(88,44,56,0.95)", blob2: "rgba(150,62,90,0.45)", blob3: "rgba(220,140,160,0.20)",
      s1: "rgba(255,255,255,0.06)", s2: "rgba(255,255,255,0.11)", line: "rgba(255,255,255,0.13)", hi: "rgba(255,255,255,0.18)",
      text: "#F8EEF1", muted: "#C4ACB4", acc: "#582C38", onAcc: "#FFFFFF", ink: "#EBB0C1",
      soft: "rgba(235,176,193,0.16)", track: "rgba(255,255,255,0.10)", pbd: "rgba(235,176,193,0.45)", glow: "rgba(200,90,120,0.5)",
      c2: "#E8B86B", c3: "#7FC8B8", c4: "#C3A6E8", bad: "#F08A8A", good: "#7FC8B8", solid: "#1A0E12"
    },
    light: {
      bg: "#F7EFF1", blob1: "rgba(88,44,56,0.32)", blob2: "rgba(225,160,180,0.50)", blob3: "rgba(245,205,175,0.45)",
      s1: "rgba(255,255,255,0.58)", s2: "rgba(255,255,255,0.80)", line: "rgba(255,255,255,0.88)", hi: "rgba(255,255,255,0.95)",
      text: "#1E1014", muted: "#5F4A51", acc: "#582C38", onAcc: "#FFFFFF", ink: "#582C38",
      soft: "rgba(88,44,56,0.10)", track: "rgba(30,16,20,0.08)", pbd: "rgba(88,44,56,0.2)", glow: "rgba(88,44,56,0.35)",
      c2: "#9A5F0E", c3: "#17705F", c4: "#6447A8", bad: "#B42318", good: "#17705F", solid: "#FCF7F8"
    }
  }
};

// Saved profile.theme values: "male" | "female" | "neutral" (neutral = prefer not to say → steel blue).
export const familyFor = (themeKey) => (themeKey === "female" ? "women" : "men");

export function makeTheme(themeKey, mode) {
  const family = familyFor(themeKey);
  const dark = mode !== "light";
  return { ...PALETTES[family][dark ? "dark" : "light"], dark, family, mode: dark ? "dark" : "light" };
}

export const COLOR_CHOICES = [
  { key: "male", label: "Steel blue", hex: "#8299B7" },
  { key: "female", label: "Plum", hex: "#582C38" }
];

// Colour per goal category / task source, so the same area always looks the same.
export const areaColor = (t, area) =>
  ({ fitness: t.c3, money: t.c2, career: t.c4, business: t.ink, learning: t.c4, goal: t.ink, custom: t.muted }[area] ?? t.ink);

// Emoji per area, used in lists and tags.
export const areaEmoji = (area) =>
  ({ fitness: "💪", money: "💰", career: "💼", business: "🚀", learning: "📚", goal: "🎯", personal: "🌱", custom: "📝" }[area] ?? "🎯");
