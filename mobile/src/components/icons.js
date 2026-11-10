import Svg, { Circle, Path, Rect } from "react-native-svg";

// One consistent line-icon set (24px grid, round caps). Use <Icon name="target" color={t.ink} />.
const P = {
  sun: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"],
  moon: ["M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.6 6.6 0 0 0 11 11z"],
  contrast: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 3v18", "M12 3a9 9 0 0 1 0 18"],
  target: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z", "M12 11.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z"],
  wallet: ["M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1 1 0 0 1 1 1v2", "M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5z", "M16 13.5h.01"],
  dumbbell: ["M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"],
  book: ["M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z", "M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z"],
  briefcase: ["M4 8h16a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1z", "M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2", "M3 13h18"],
  rocket: ["M12 15l-3-3c1-4 3.5-7.5 9-9 0 5.5-3.5 8-6 9.5z", "M9 12H5.5l2-3.5H11M12 15v3.5l3.5-2V13", "M6.5 16.5c-1.5 1-2 3.5-2 3.5s2.5-.5 3.5-2"],
  sparkles: ["M10 3l1.7 4.6L16.3 9.3l-4.6 1.7L10 15.6 8.3 11 3.7 9.3l4.6-1.7z", "M18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z"],
  scale: ["M12 4v16M8 20h8M5 7h14", "M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"],
  leaf: ["M5 19c0-8 5-13 15-14-1 10-6 15-14 15", "M5 19c3-3 6-6 9-8"],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
  crown: ["M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5z", "M5 21h14"],
  card: ["M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z", "M3 10h18M7 15h3"],
  lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  shield: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M9 12l2 2 4-4"],
  help: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6", "M12 17h.01"],
  gift: ["M4 11h16v10H4zM3 7h18v4H3zM12 7v14", "M12 7S11 3 8.5 3a2 2 0 0 0 0 4zM12 7s1-4 3.5-4a2 2 0 0 1 0 4z"],
  file: ["M6 3h8l4 4v14H6z", "M14 3v4h4M9 12h6M9 16h6"],
  logout: ["M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3", "M10 17l-5-5 5-5M5 12h11"],
  trash: ["M4 7h16M10 11v6M14 11v6", "M6 7l1 13h10l1-13M9 7V4h6v3"],
  camera: ["M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z", "M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"],
  image: ["M4 4h16v16H4z", "M9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM20 15l-5-5L4 20"],
  mail: ["M3 5h18v14H3z", "M3 6l9 7 9-7"],
  key: ["M14.5 9.5a4 4 0 1 0-1.2 2.9L21 20M17 16l2-2M19 18l1.5-1.5"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  x: ["M6 6l12 12M18 6L6 18"],
  plus: ["M12 5v14M5 12h14"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4"],
  pencil: ["M4 20l4-1L19 8l-3-3L5 16z", "M14 7l3 3"],
  flame: ["M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5.5 1-8.5z"],
  calendar: ["M4 6h16v15H4z", "M4 10h16M8 3v4M16 3v4"],
  chart: ["M5 20V11M11 20V5M17 20v-6M3 20h18"],
  trend: ["M3 17l6-6 4 4 8-8", "M15 7h6v6"],
  megaphone: ["M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z", "M17 9a4 4 0 0 1 0 6"],
  info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 11v5M12 8h.01"],
  alert: ["M12 4l9 16H3z", "M12 10v4M12 17h.01"],
  send: ["M21 3L10 14", "M21 3l-7 18-4-7-7-4z"],
  phone: ["M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M11 18h2"],
  cake: ["M4 13h16v8H4z", "M4 16c2 0 2 1 4 1s2-1 4-1 2 1 4 1 2-1 4-1M12 13V9M12 6.5a1 1 0 0 0 1-1C13 4.5 12 3 12 3s-1 1.5-1 2.5a1 1 0 0 0 1 1z"],
  globe: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z"],
  chat: ["M4 5h16v11H9l-5 4z"],
  refresh: ["M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4", "M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"],
  heart: ["M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5C20 15.4 12 20 12 20z"],
  gear: ["M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"],
  star: ["M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"],
  infinity: ["M7.5 8.5C4 8.5 3 12 3 12s1 3.5 4.5 3.5S12 12 12 12s-1-3.5-4.5-3.5zM16.5 8.5C20 8.5 21 12 21 12s-1 3.5-4.5 3.5S12 12 12 12s1-3.5 4.5-3.5z"],
  ban: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8"],
  arrowUp: ["M12 19V5M6 11l6-6 6 6"],
  play: ["M7 4.5v15l12-7.5z"],
  pause: ["M8 5v14M16 5v14"],
  skip: ["M5 5l10 7-10 7zM19 5v14"],
  minus: ["M5 12h14"],
  timer: ["M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M12 9v4l2.5 2.5M10 2h4"],
  bolt: ["M13 2L4 14h7l-1 8 9-12h-7z"],
  trophy: ["M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"],
  coins: ["M9 8a6 3 0 1 0 0-.01zM3 8v4c0 1.7 2.7 3 6 3s6-1.3 6-3V8", "M15 11.5c3 .3 6 1.4 6 3v3c0 1.7-2.7 3-6 3-1.8 0-3.4-.4-4.5-1"],
  cart: ["M3 4h2l2.4 11h10.2L20 7H6.2", "M9 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01"],
  car: ["M5 16v3M19 16v3M3 12l2-5h14l2 5v4H3z", "M7 13h.01M17 13h.01"],
  utensils: ["M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 7h3"],
  receipt: ["M6 3h12v18l-3-2-3 2-3-2-3 2z", "M9 8h6M9 12h6"],
  home: ["M4 11l8-7 8 7v9H4z", "M10 20v-5h4v5"],
  music: ["M9 18V6l10-2v12", "M9 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM19 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"],
  water: ["M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"],
  stretch: ["M12 5a2 2 0 1 0 0-.01M6 21l3-7 3 2 3-2 3 7M5 9l7 2 7-2"],
  sunrise: ["M12 3v4M5 10l1.5 1.5M19 10l-1.5 1.5M3 18h18M7 18a5 5 0 0 1 10 0", "M9 6l3-3 3 3"]
};

export function Icon({ name, color = "#000", size = 20, strokeWidth = 1.8 }) {
  const paths = P[name] ?? P.info;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      {paths.map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

// Mood scale faces, drawn to match the icon set (happy → stressed).
const MOUTHS = {
  happy: "M8.5 13.5c1.8 2.3 5.2 2.3 7 0",
  good: "M9 14c1.6 1.2 4.4 1.2 6 0",
  neutral: "M9 14.5h6",
  sad: "M9 15.5c1.6-1.6 4.4-1.6 6 0",
  stressed: "M8.5 15l1.5-1 1.5 1 1.5-1 1.5 1 1.5-1"
};
export function MoodFace({ mood, color, size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.6} />
      <Circle cx="9" cy="10" r="1" fill={color} />
      <Circle cx="15" cy="10" r="1" fill={color} />
      <Path d={MOUTHS[mood] ?? MOUTHS.neutral} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Tab bar icons (kept as named exports for the tab layout).
export const TodayIcon = ({ color, size = 24 }) => <Icon name="sun" color={color} size={size} />;
export const GoalsIcon = ({ color, size = 24 }) => <Icon name="target" color={color} size={size} />;
export const LifeIcon = ({ color, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3.5" y="3.5" width="7" height="7" rx="2" /><Rect x="13.5" y="3.5" width="7" height="7" rx="2" /><Rect x="3.5" y="13.5" width="7" height="7" rx="2" /><Rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Svg>
);
export const ProgressIcon = ({ color, size = 24 }) => <Icon name="chart" color={color} size={size} />;
export const AssistantIcon = ({ color, size = 24 }) => <Icon name="sparkles" color={color} size={size} />;
export const GearIcon = ({ color, size = 22 }) => <Icon name="gear" color={color} size={size} />;
