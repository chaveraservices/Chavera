import { useState, useRef } from 'react';

// Single-series area chart of entries-per-series. One brand hue (no legend
// needed — the title names it), a 2px line over a soft gradient fill anchored to
// the baseline, recessive grid, and a hover crosshair + tooltip.
//
// data: [{ series, count, from, to }]  ·  onPick(series) optional
export default function SeriesAreaChart({ data, highlight, onPick }) {
  const [hover, setHover] = useState(null); // index
  const wrapRef = useRef(null);

  const pts = (data || []).filter(d => d && Number.isFinite(d.count));
  if (pts.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '24px 0' }}>No series data yet.</div>;
  }

  // ViewBox coordinate space; the SVG scales to its container width.
  const W = 720, H = 240;
  const padL = 44, padR = 16, padT = 16, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxCount = Math.max(...pts.map(d => d.count), 1);
  // "Nice" top for the y-axis so gridlines land on round numbers.
  const mag = Math.pow(10, Math.floor(Math.log10(maxCount)));
  const niceTop = Math.ceil(maxCount / mag) * mag;

  const x = (i) => padL + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
  const y = (v) => padT + innerH - (v / niceTop) * innerH;

  const linePath = pts.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.count).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(pts.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => (niceTop / gridLines) * i);

  // Show at most ~8 x labels so they never collide.
  const labelStep = Math.max(1, Math.ceil(pts.length / 8));

  const onMove = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    // Nearest point by x.
    let best = 0, bestD = Infinity;
    pts.forEach((_, i) => { const d = Math.abs(x(i) - px); if (d < bestD) { bestD = d; best = i; } });
    setHover(best);
  };

  const hv = hover != null ? pts[hover] : null;

  return (
    <div className="series-chart" ref={wrapRef} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', cursor: onPick ? 'pointer' : 'default' }}
        onClick={() => { if (onPick && hv) onPick(hv.series); }}>
        <defs>
          <linearGradient id="seriesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E25C24" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#E25C24" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Recessive horizontal grid + y labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--border-color)" strokeWidth="1" />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
              {v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : v}
            </text>
          </g>
        ))}

        {/* Area + line */}
        <path d={areaPath} fill="url(#seriesFill)" />
        <path d={linePath} fill="none" stroke="#E25C24" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Point markers; the highlighted / hovered one grows. */}
        {pts.map((d, i) => {
          const on = (highlight != null && d.series === highlight) || hover === i;
          return <circle key={i} cx={x(i)} cy={y(d.count)} r={on ? 5 : 3}
            fill={on ? '#F2762F' : '#E25C24'} stroke="var(--bg-white)" strokeWidth={on ? 2 : 0} />;
        })}

        {/* X labels (series numbers) */}
        {pts.map((d, i) => (i % labelStep === 0 || i === pts.length - 1) ? (
          <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{d.series}</text>
        ) : null)}

        {/* Hover crosshair */}
        {hv && <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + innerH} stroke="#E25C24" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />}
      </svg>

      {/* Tooltip */}
      {hv && (
        <div className="series-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <div className="series-tip-title">Series {hv.series}</div>
          <div className="series-tip-sub">Entries {hv.from}–{hv.to}</div>
          <div className="series-tip-val">{hv.count} {hv.count === 1 ? 'entry' : 'entries'}</div>
        </div>
      )}
    </div>
  );
}
