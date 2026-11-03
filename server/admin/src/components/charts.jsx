import { useEffect, useRef, useState } from "react";
import { fmt } from "../api.js";

// Single-series daily bar chart: one hue, hover tooltip, hidden data table for screen readers.
// Drawn at the container's real pixel width so text and bar gaps never scale.
export function DailyBars({ data, valueKey, label, format = fmt.num }) {
  const [hover, setHover] = useState(null);
  const [W, setW] = useState(640);
  const box = useRef(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const H = 200, padL = 36, padB = 22, padT = 8;
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const nice = niceMax(max);
  const plotW = W - padL, plotH = H - padB - padT;
  const step = plotW / data.length;
  const barW = Math.max(2, step - 2); // 2px surface gap between bars
  const y = (v) => padT + plotH - (v / nice) * plotH;
  const ticks = [0, nice / 2, nice];

  return (
    <div className="chart" ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}, last 30 days`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={padL} x2={W} y1={y(t)} y2={y(t)} />
            <text className="axis-text" x={padL - 6} y={y(t) + 4} textAnchor="end">{fmt.compact(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = d[valueKey];
          const x = padL + i * step + 1;
          const h = Math.max(0, y(0) - y(v));
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect className="hit" x={padL + i * step} y={padT} width={step} height={plotH} fill="transparent" />
              {v > 0 && <path className={`bar${hover === i ? " on" : ""}`} d={roundedTop(x, y(v), barW, h, Math.min(4, barW / 2))} />}
            </g>
          );
        })}
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) => (
          <text key={i} className="axis-text" x={padL + i * step + step / 2} y={H - 4} textAnchor="middle">
            {shortDay(data[i]?.day)}
          </text>
        ))}
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: `${((padL + hover * step + step / 2) / W) * 100}%`, top: `${(y(data[hover][valueKey]) / H) * 100}%` }}>
          <strong>{format(data[hover][valueKey])}</strong> <span className="muted">{label.toLowerCase()} · {shortDay(data[hover].day)}</span>
        </div>
      )}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.day}><th scope="row">{d.day}</th><td>{d[valueKey]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Horizontal magnitude bars with direct labels: one hue, the label names each row.
export function Breakdown({ rows, emptyText = "No data yet." }) {
  if (!rows.length) return <p className="empty">{emptyText}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      {rows.map((r) => (
        <div className="hbar" key={r.label}>
          <span>{r.label}</span>
          <span className="track"><span className="fill" style={{ display: "block", width: `${(r.count / max) * 100}%` }} /></span>
          <span className="num" style={{ textAlign: "right" }}>{fmt.num(r.count)}</span>
        </div>
      ))}
    </div>
  );
}

export function StatTile({ label, value, sub }) {
  return (
    <div className="card tile">
      <div className="label">{label}</div>
      <div className="value num">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function roundedTop(x, y, w, h, r) {
  if (h < r) r = h;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

const shortDay = (ymd) => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
