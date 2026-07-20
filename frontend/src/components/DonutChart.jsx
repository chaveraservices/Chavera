import { useState, useMemo } from 'react';
import { Table2, PieChart as PieIcon } from 'lucide-react';

// Categorical slots, validated with the dataviz palette validator against this
// app's white card surface (#FFFFFF), all-pairs, light mode:
//   worst CVD pair dE 13.0 (protan), worst normal-vision pair dE 16.3 — both pass.
// Magenta and yellow sit below 3:1 contrast on white, which obliges the relief
// channel: every slice is direct-labelled in the legend and repeated in the
// table view, so colour never carries identity on its own.
// The brand orange (#E25C24) is deliberately NOT a slice colour — against the
// green slot it measures dE 1.3 under protanopia, i.e. indistinguishable. It
// stays the UI accent.
const SLICE_COLORS = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#4a3aa7'];
const OTHER_COLOR = '#898781'; // de-emphasis gray — a residual, not an identity

const TAU = Math.PI * 2;

// Cap identity slices at 5; everything past that folds into "Other" so the
// donut never exceeds the 6-segment readability limit.
const MAX_SLICES = 5;

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle - Math.PI / 2), cy + r * Math.sin(angle - Math.PI / 2)];
}

// Annular segment path. `gap` is an angular inset that renders as a 2px surface
// gap between neighbouring slices instead of a drawn border.
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
 * Donut chart for part-to-whole at a glance.
 *
 * IMPORTANT: `data` must genuinely sum to the whole being shown. For products
 * the whole is *product selections*, not contacts — a contact can pick several
 * products, so the slice percentages are "share of all selections". The caller
 * is responsible for a caption that says so.
 */
export default function DonutChart({ data, total, onSliceClick, valueNoun = 'selections' }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);

  // Fold the tail into "Other" so we never exceed 6 segments.
  const slices = useMemo(() => {
    const sorted = [...(data || [])].sort((a, b) => b.count - a.count);
    if (sorted.length <= MAX_SLICES + 1) {
      return sorted.map((d, i) => ({ ...d, color: SLICE_COLORS[i] || OTHER_COLOR, isOther: false }));
    }
    const head = sorted.slice(0, MAX_SLICES).map((d, i) => ({ ...d, color: SLICE_COLORS[i], isOther: false }));
    const tail = sorted.slice(MAX_SLICES);
    return [
      ...head,
      {
        label: 'Other',
        count: tail.reduce((s, d) => s + d.count, 0),
        color: OTHER_COLOR,
        isOther: true,
        members: tail.map(d => `${d.label} (${d.count})`),
      },
    ];
  }, [data]);

  const sum = slices.reduce((s, d) => s + d.count, 0);

  if (!slices.length || sum === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '24px 0' }}>
        No products recorded on contacts yet.
      </div>
    );
  }

  const SIZE = 240;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const rOuter = 104;
  const rInner = 64; // donut hole carries the headline number
  const gapPx = 2;
  const gapAngle = gapPx / rOuter / 2;

  // Build the segments in one pass so start/end angles accumulate correctly.
  let cursor = 0;
  const segments = slices.map(d => {
    const angle = (d.count / sum) * TAU;
    const seg = { ...d, start: cursor, end: cursor + angle, pct: (d.count / sum) * 100 };
    cursor += angle;
    return seg;
  });

  const active = hover != null ? segments[hover] : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button
          className="btn-link"
          onClick={() => setShowTable(t => !t)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: 'var(--text-muted)', padding: '4px 6px' }}
          title={showTable ? 'Show the donut' : 'Show the same figures as a table'}
        >
          {showTable ? <PieIcon size={14} /> : <Table2 size={14} />}
          {showTable ? 'Chart view' : 'Table view'}
        </button>
      </div>

      {showTable ? (
        // The relief channel: every value readable without colour at all.
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Product</th>
              <th style={{ textAlign: 'right' }}>{valueNoun[0].toUpperCase() + valueNoun.slice(1)}</th>
              <th style={{ textAlign: 'right' }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {segments.map(s => (
              <tr key={s.label}>
                <td>{s.isOther && s.members ? `Other — ${s.members.join(', ')}` : s.label}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.count}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.pct.toFixed(1)}%</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 600 }}>
              <td>Total</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sum}</td>
              <td style={{ textAlign: 'right' }}>100%</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width={SIZE} height={SIZE} role="img"
              aria-label={`Donut chart of ${valueNoun} by product. ${segments.map(s => `${s.label} ${s.pct.toFixed(1)} percent`).join(', ')}.`}>
              {segments.map((s, i) => (
                <path
                  key={s.label}
                  d={arcPath(cx, cy, rOuter, rInner, s.start, s.end, gapAngle)}
                  fill={s.color}
                  opacity={hover == null || hover === i ? 1 : 0.35}
                  style={{ cursor: onSliceClick && !s.isOther ? 'pointer' : 'default', transition: 'opacity .12s' }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={onSliceClick && !s.isOther ? () => onSliceClick(s.label) : undefined}
                />
              ))}
              {/* Donut hole: the headline number, or the hovered slice */}
              <text x={cx} y={cy - 4} textAnchor="middle"
                style={{ fontSize: active ? '1.4rem' : '1.6rem', fontWeight: 700, fill: 'var(--text-dark)' }}>
                {active ? `${active.pct.toFixed(1)}%` : sum}
              </text>
              <text x={cx} y={cy + 16} textAnchor="middle"
                style={{ fontSize: '0.72rem', fill: 'var(--text-muted)' }}>
                {active ? active.label : valueNoun}
              </text>
            </svg>
          </div>

          {/* Legend doubles as the direct-label channel: name + value + share,
              so identity never rests on colour alone. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 190, flex: 1 }}>
            {segments.map((s, i) => (
              <div
                key={s.label}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={onSliceClick && !s.isOther ? () => onSliceClick(s.label) : undefined}
                title={s.isOther && s.members ? s.members.join(', ') : `${s.label}: ${s.count}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '5px 8px', borderRadius: 6, minHeight: 24,
                  background: hover === i ? 'var(--bg-main)' : 'transparent',
                  cursor: onSliceClick && !s.isOther ? 'pointer' : 'default',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dark)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          </div>
        </div>
      )}
    </div>
  );
}
