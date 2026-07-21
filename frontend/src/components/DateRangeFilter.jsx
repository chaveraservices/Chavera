import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, Check, ChevronDown } from 'lucide-react';
import Calendar from './Calendar';

// Local 'YYYY-MM-DD' — toISOString() would shift the day for anyone east or
// west of UTC, which silently moves the range boundary by a day.
const iso = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

// Presets return {from, to}; nulls mean "unbounded on that side".
const PRESETS = [
  { id: 'all', label: 'All time', range: () => ({ from: null, to: null }) },
  { id: '7', label: 'Last 7 days', range: () => ({ from: iso(daysAgo(6)), to: iso(new Date()) }) },
  { id: '30', label: 'Last 30 days', range: () => ({ from: iso(daysAgo(29)), to: iso(new Date()) }) },
  { id: '90', label: 'Last 90 days', range: () => ({ from: iso(daysAgo(89)), to: iso(new Date()) }) },
  {
    id: 'mtd', label: 'This month',
    range: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(n) }; },
  },
  {
    id: 'ytd', label: 'This year',
    range: () => { const n = new Date(); return { from: iso(new Date(n.getFullYear(), 0, 1)), to: iso(n) }; },
  },
];

const fmt = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

/**
 * Date-range control for the dashboard. Defaults to "All time" so the first
 * view shows everything, then narrows on demand.
 *
 * value: { preset, from, to }   onChange: same shape
 */
export default function DateRangeFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  // Draft custom dates, so a half-typed range doesn't refetch on every keystroke.
  const [draft, setDraft] = useState({ from: value.from || '', to: value.to || '' });
  const [err, setErr] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);

  useEffect(() => { setDraft({ from: value.from || '', to: value.to || '' }); }, [value.from, value.to]);

  const pick = (p) => {
    setErr('');
    onChange({ preset: p.id, ...p.range() });
    setOpen(false);
  };

  // Clear isn't just "empty the draft" — it takes the dashboard back to the
  // unfiltered view. Clearing the draft alone would leave the previously
  // applied range in force, so the button would still read a date window while
  // the fields sat empty.
  const clearToAllTime = () => {
    setDraft({ from: '', to: '' });
    setErr('');
    onChange({ preset: 'all', from: null, to: null });
    setOpen(false);
  };

  const applyCustom = () => {
    if (!draft.from && !draft.to) { setErr('Pick at least one date.'); return; }
    if (draft.from && draft.to && draft.from > draft.to) {
      setErr('"From" is after "To" — swap them.');
      return;
    }
    setErr('');
    onChange({ preset: 'custom', from: draft.from || null, to: draft.to || null });
    setOpen(false);
  };

  const current = PRESETS.find(p => p.id === value.preset);
  const label = value.preset === 'custom'
    ? (value.from && value.to ? `${fmt(value.from)} – ${fmt(value.to)}`
      : value.from ? `From ${fmt(value.from)}` : `Until ${fmt(value.to)}`)
    : (current?.label || 'All time');

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        className="btn"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          border: '1px solid var(--border-color)',
          background: value.preset === 'all' ? 'var(--bg-white)' : 'var(--highlight)',
          color: value.preset === 'all' ? 'var(--text-dark)' : 'var(--primary-accent)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <CalendarIcon size={16} />
        {label}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="date-range-pop">
          {PRESETS.map(p => (
            <div
              key={p.id}
              className="date-range-opt"
              onClick={() => pick(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(p); } }}
            >
              <span style={{ width: 16, display: 'inline-flex' }}>
                {value.preset === p.id && <Check size={16} strokeWidth={3} />}
              </span>
              {p.label}
            </div>
          ))}

          <div className="date-range-custom">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Custom range
            </div>
            {/* Readout of the current draft — the calendar is the input, these
                are feedback, so a half-picked range reads clearly. */}
            <div className="cal-readout">
              <div className={`cal-readout-slot ${draft.from && !draft.to ? 'is-active' : ''}`}>
                <span>From</span>
                <strong>{draft.from ? fmt(draft.from) : '—'}</strong>
              </div>
              <span className="cal-readout-sep">–</span>
              <div className={`cal-readout-slot ${draft.from && !draft.to ? 'is-next' : ''}`}>
                <span>To</span>
                <strong>{draft.to ? fmt(draft.to) : '—'}</strong>
              </div>
            </div>

            <Calendar
              value={{ from: draft.from || null, to: draft.to || null }}
              onChange={(r) => { setErr(''); setDraft({ from: r.from || '', to: r.to || '' }); }}
            />

            {err && <div style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn" style={{ flex: 1, border: '1px solid var(--border-color)', background: 'var(--bg-white)', justifyContent: 'center' }}
                onClick={clearToAllTime}>
                Clear
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={applyCustom}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
