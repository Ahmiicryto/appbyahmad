import Svg, { Circle, Path, Rect } from "react-native-svg";

const base = (color, size) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" });

export const TodayIcon = ({ color, size = 24 }) => (
  <Svg {...base(color, size)}><Circle cx="12" cy="12" r="4" /><Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
);
export const GoalsIcon = ({ color, size = 24 }) => (
  <Svg {...base(color, size)}><Circle cx="12" cy="12" r="9" /><Circle cx="12" cy="12" r="5" /><Circle cx="12" cy="12" r="1" /></Svg>
);
export const LifeIcon = ({ color, size = 24 }) => (
  <Svg {...base(color, size)}><Rect x="3" y="3" width="7" height="7" rx="2" /><Rect x="14" y="3" width="7" height="7" rx="2" /><Rect x="3" y="14" width="7" height="7" rx="2" /><Rect x="14" y="14" width="7" height="7" rx="2" /></Svg>
);
export const ProgressIcon = ({ color, size = 24 }) => (
  <Svg {...base(color, size)}><Path d="M5 20V11M11 20V5M17 20v-6M3 20h18" /></Svg>
);
export const AssistantIcon = ({ color, size = 24 }) => (
  <Svg {...base(color, size)}><Path d="M11 3l1.8 4.7 4.7 1.8-4.7 1.8L11 16l-1.8-4.7L4.5 9.5l4.7-1.8z" /><Path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></Svg>
);
export const GearIcon = ({ color, size = 22 }) => (
  <Svg {...base(color, size)}><Circle cx="12" cy="12" r="3" /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Svg>
);
