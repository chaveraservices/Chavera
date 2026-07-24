import { useState, useMemo } from 'react';
import { Table2, PieChart as PieIcon, BarChart3 } from 'lucide-react';

// Categorical slots, validated with the dataviz palette validator against the
// dark card surface (#1A1A19), all-pairs: worst CVD pair ΔE 6.9 (protan, in the
// 6–8 floor band — legal because every slice is direct-labelled in the legend
// and repeated in the table view) and worst normal-vision pair ΔE 19.3.
// A 5th hue collides with the blue slot (ΔE 1.9 protan), so the donut caps at
// four named products; the rest fold into a grey residual.
const SLICE_COLORS = ['#3987e5', '#008300', '#d55181', '#c98500'];
const OTHER_COLOR = '#8A8A86';   // residual, not an identity
const BAR_COLOR = '#3987e5';
const MAX_SLICES = 4;

const TAU = Math.PI * 2;

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle - Math.PI / 2), cy + r * Math.sin(angle - Math.PI / 2)];
}

// Annular segment path. `gap` is an angular inset that renders as a surface gap
// between neighbouring slices instead of a drawn border.
function arcPath(cx, cy, rOuter, rInner, start, end, gap) {
  const s = start + gap;
  const e = Math.max(s + 0.0001, end - gap);
  const large = e - s > Math.PI ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOuter, s);
  const [x2, y2] = polar(cx, cy, rOuter, e);
  const [x3, y3] = polar(cx, cy, rInner, e);
  const [x4, y4] = polar(cx, cy, rInner, s);
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

/**
 * Product-mix donut. Three views of the same data (Share / Ranked / Table).
 *
 * Clicking a named slice (or bar) calls `onSelect(label, { count, pct })` — the
 * dashboard uses that to open a summary popover with a "See all entries" button.
 * The "All products" focus dropdown was removed on client request; drill-in now
 * goes through that summary step instead.
 *
 * `data` must sum to the whole being shown. For products the whole is
 * *selections*, not contacts — a contact can pick several — so the caller is
 * responsible for a caption saying so.
 */
export default function DonutChart({ data, onSelect, valueNoun = 'selections' }) {
  const [hover, setHover] = useState(null);
  const [view, setView] = useState('donut');   // donut | bars | table

  const sorted = useMemo(
    () => [...(data || [])].sort((a, b) => b.count - a.count),
    [data],
  );

  const segments = useMemo(() => {
    const sum = sorted.reduce((s, d) => s + d.count, 0);
    if (!sum) return [];

    if (sorted.length <= MAX_SLICES) {
      return sorted.map((d, i) => ({ ...d, color: SLICE_COLORS[i], isOther: false, pct: (d.count / sum) * 100 }));
    }
    const head = sorted.slice(0, MAX_SLICES).map((d, i) => ({ ...d, color: SLICE_COLORS[i], isOther: false, pct: (d.count / sum) * 100 }));
    const tail = sorted.slice(MAX_SLICES);
    // A residual of exactly one product keeps its own name.
    if (tail.length === 1) {
      return [...head, { ...tail[0], color: OTHER_COLOR, isOther: false, pct: (tail[0].count / sum) * 100 }];
    }
    const otherCount = tail.reduce((s, d) => s + d.count, 0);
    return [...head, {
      label: 'Other',
      count: otherCount,
      color: OTHER_COLOR,
      isOther: true,
      members: tail,
      pct: (otherCount / sum) * 100,
    }];
  }, [sorted]);

  const sum = segments.reduce((s, d) => s + d.count, 0);

  if (!segments.length || sum === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '24px 0' }}>
        No products recorded on entries yet.
      </div>
    );
  }

  const select = (seg) => {
    if (!onSelect || seg.isOther) return;
    onSelect(seg.label, { count: seg.count, pct: seg.pct });
  };

  const SIZE = 240;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const rOuter = 104;
  const rInner = 64;
  const gapAngle = 2 / rOuter / 2;

  let cursor = 0;
  const arcs = segments.map(d => {
    const angle = (d.count / sum) * TAU;
    const seg = { ...d, start: cursor, end: cursor + angle };
    cursor += angle;
    return seg;
  });

  const active = hover != null ? arcs[hover] : null;
  const centreBig = active ? `${active.pct.toFixed(1)}%` : sum;
  const centreSmall = active ? active.label : valueNoun;

  return (
    <div>
      <div className="donut-controls">
        {/* The "All products" filter dropdown was removed on client request.
            One dataset, three readings: share, ranked counts, exact values. */}
        <div className="view-switch" role="group" aria-label="Chart view">
          {[
            ['donut', <PieIcon size={14} key="d" />, 'Share'],
            ['bars', <BarChart3 size={14} key="b" />, 'Ranked'],
            ['table', <Table2 size={14} key="t" />, 'Table'],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              className={`view-switch-btn ${view === id ? 'active' : ''}`}
              onClick={() => setView(id)}
              aria-pressed={view === id}
            >
              {icon}<span>{label}</span>
            </button>
          ))}
        </div>
        {onSelect && (
          <span className="donut-tip">Click a product for a summary</span>
        )}
      </div>

      {view === 'table' ? (
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Product</th>
              <th style={{ textAlign: 'right' }}>{valueNoun[0].toUpperCase() + valueNoun.slice(1)}</th>
              <th style={{ textAlign: 'right' }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(d => (
              <tr
                key={d.label}
                onClick={onSelect ? () => onSelect(d.label, { count: d.count, pct: (d.count / sum) * 100 }) : undefined}
                className={onSelect ? 'row-clickable' : undefined}
              >
                <td>{d.label}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.count}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {((d.count / sum) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
            <tr style={{ fontWeight: 600 }}>
              <td>Total</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sum}</td>
              <td style={{ textAlign: 'right' }}>100%</td>
            </tr>
          </tbody>
        </table>
      ) : view === 'bars' ? (
        <div className="donut-bars">
          {sorted.map(d => {
            const max = Math.max(...sorted.map(x => x.count), 1);
            return (
              <div
                key={d.label}
                className="bar-row"
                onClick={onSelect ? () => onSelect(d.label, { count: d.count, pct: (d.count / sum) * 100 }) : undefined}
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
                title={`${d.label}: ${d.count}`}
              >
                <div className="bar-label">{d.label}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(d.count / max) * 100}%`, background: BAR_COLOR }} />
                </div>
                <div className="bar-count">{d.count}</div>
                <div className="bar-pct">{((d.count / sum) * 100).toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width={SIZE} height={SIZE} role="img"
              aria-label={`Donut chart of ${valueNoun} by product. ${arcs.map(s => `${s.label} ${s.pct.toFixed(1)} percent`).join(', ')}.`}>
              {arcs.map((s, i) => (
                <path
                  key={s.label}
                  d={arcPath(cx, cy, rOuter, rInner, s.start, s.end, gapAngle)}
                  fill={s.color}
                  opacity={hover == null || hover === i ? 1 : 0.35}
                  style={{ cursor: onSelect && !s.isOther ? 'pointer' : 'default', transition: 'opacity .12s' }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => select(s)}
                />
              ))}
              <text x={cx} y={cy - 4} textAnchor="middle"
                style={{ fontSize: active ? '1.4rem' : '1.6rem', fontWeight: 700, fill: 'var(--text-dark)' }}>
                {centreBig}
              </text>
              <text x={cx} y={cy + 16} textAnchor="middle"
                style={{ fontSize: '0.72rem', fill: 'var(--text-muted)' }}>
                {centreSmall}
              </text>
            </svg>
          </div>

          {/* Legend doubles as the direct-label channel: name + value + share,
              so identity never rests on colour alone. */}
          <div className="donut-legend">
            {arcs.map((s, i) => (
              <div
                key={s.label}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => select(s)}
                title={s.isOther ? s.members.map(m => `${m.label} (${m.count})`).join(', ') : `${s.label}: ${s.count}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '5px 8px', borderRadius: 6, minHeight: 24,
                  background: hover === i ? 'var(--bg-main)' : 'transparent',
                  cursor: onSelect && !s.isOther ? 'pointer' : 'default',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                <span style={{
                  fontSize: '0.85rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  color: 'var(--text-dark)',
                }}>
                  {s.label}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.count}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', fontVariantNumeric: 'tabular-nums', width: 46, textAlign: 'right' }}>
                  {s.pct.toFixed(1)}%
                </span>
              </div>
            ))}

            {/* Name what got folded away so "Other" is never an unexplained block. */}
            {arcs.some(a => a.isOther) && (
              <div className="donut-other-note">
                Other = {arcs.find(a => a.isOther).members.map(m => `${m.label} (${m.count})`).join(', ')}.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
