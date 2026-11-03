// Colour tokens from the design canvas. Gender picks the default theme; users can change it in Settings.
export const THEMES = {
  male: {
    name: "Black + Green",
    dark: true,
    bg: "#090C0A", s1: "#111713", s2: "#18211B", line: "#253029",
    text: "#EEF4EF", muted: "#9AAAA0",
    acc: "#22C55E", onAcc: "#03140A", ink: "#4ADE80", soft: "rgba(74,222,128,0.10)", track: "#1F2A23",
    c2: "#F5B841", c3: "#5AB8F0", c4: "#B794F6", bad: "#F87171"
  },
  female: {
    name: "Black + Maroon",
    dark: true,
    bg: "#0C090A", s1: "#171012", s2: "#21161A", line: "#35252B",
    text: "#F6EEF0", muted: "#BCA4AB",
    acc: "#9B1C3A", onAcc: "#FFFFFF", ink: "#F2849E", soft: "rgba(242,132,158,0.10)", track: "#2B1E22",
    c2: "#F5B841", c3: "#5AB8F0", c4: "#B794F6", bad: "#F87171"
  },
  neutral: {
    name: "White + Black",
    dark: false,
    bg: "#FFFFFF", s1: "#F4F4F5", s2: "#EAEAEC", line: "#E1E1E4",
    text: "#0A0A0A", muted: "#55555E",
    acc: "#0A0A0A", onAcc: "#FFFFFF", ink: "#0A0A0A", soft: "rgba(10,10,10,0.05)", track: "#E4E4E7",
    c2: "#9A6A12", c3: "#1F6FB2", c4: "#6B46C1", bad: "#C53030"
  }
};

// Colour per goal category / task source, so the same area always looks the same.
export const areaColor = (t, area) =>
  ({ fitness: t.c3, money: t.c2, career: t.c4, business: t.ink, learning: t.c4, goal: t.ink, custom: t.muted }[area] ?? t.ink);
