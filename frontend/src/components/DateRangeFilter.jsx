import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, Check, ChevronDown } from 'lucide-react';
import Calendar from './Calendar';
import { parseDateInput } from '../utils/parseDateInput';

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
  // Raw text of the two boxes, kept separate from the parsed draft so a
  // half-typed value isn't destroyed on every keystroke.
  const [typed, setTyped] = useState({ from: '', to: '' });
  const [focusSide, setFocusSide] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);

  useEffect(() => {
    setDraft({ from: value.from || '', to: value.to || '' });
    setTyped({ from: value.from ? fmt(value.from) : '', to: value.to ? fmt(value.to) : '' });
  }, [value.from, value.to]);

  // Clicking the calendar must write back into the text boxes, or the two
  // halves of the control disagree about what is selected.
  const setFromCalendar = (r) => {
    setErr('');
    setDraft({ from: r.from || '', to: r.to || '' });
    setTyped({ from: r.from ? fmt(r.from) : '', to: r.to ? fmt(r.to) : '' });
  };

  // Parse one box on blur/Enter. `to` widens partial input to the end of the
  // period, so "2026" means 31 Dec 2026 rather than 1 Jan.
  const commitTyped = (side) => {
    setFocusSide(null);
    const raw = typed[side];
    if (!raw.trim()) {
      setDraft(d => ({ ...d, [side]: '' }));
      setErr('');
      return;
    }
    const parsed = parseDateInput(raw, side === 'to');
    if (!parsed) {
      setErr(`Could not read “${raw}”. Try 2022, 03/2022 or 15/03/2022.`);
      return;
    }
    setErr('');
    setDraft(d => ({ ...d, [side]: parsed }));
    setTyped(t => ({ ...t, [side]: fmt(parsed) }));   // echo back canonical form
  };

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
    setTyped({ from: '', to: '' });
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
  // Single-sided ranges read as open-ended: a From alone runs to today, a To
  // alone runs from the first record. The backend already treats a missing
  // bound that way; these labels just make it obvious on the button.
  const label = value.preset === 'custom'
    ? (value.from && value.to ? `${fmt(value.from)} – ${fmt(value.to)}`
      : value.from ? `${fmt(value.from)} → Today` : `Up to ${fmt(value.to)}`)
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
            {/* Typeable as well as clickable: entering 2022 and 2026 covers
                those years end to end, which beats paging a calendar back
                four years. Kept in sync with the grid below. */}
            <div className="cal-readout">
              <label className={`cal-readout-slot ${focusSide === 'from' ? 'is-active' : ''}`}>
                <span>From</span>
                <input
                  className="cal-readout-input"
                  value={typed.from}
                  placeholder="2022 or 15/03/2022"
                  onFocus={() => setFocusSide('from')}
                  onBlur={() => commitTyped('from')}
                  onChange={(e) => setTyped(t => ({ ...t, from: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTyped('from'); } }}
                  aria-label="From date"
                />
              </label>
              <span className="cal-readout-sep">–</span>
              <label className={`cal-readout-slot ${focusSide === 'to' ? 'is-active' : ''}`}>
                <span>To</span>
                <input
                  className="cal-readout-input"
                  value={typed.to}
                  placeholder="2026 or 31/12/2026"
                  onFocus={() => setFocusSide('to')}
                  onBlur={() => commitTyped('to')}
                  onChange={(e) => setTyped(t => ({ ...t, to: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTyped('to'); } }}
                  aria-label="To date"
                />
              </label>
            </div>
            <p className="cal-hint">
              Fill just <strong>From</strong> to see that date until today, or just <strong>To</strong> for everything up to it.
              Type a year (2022), a month (03/2022) or a full date — or pick below.
            </p>

            <Calendar
              value={{ from: draft.from || null, to: draft.to || null }}
              onChange={setFromCalendar}
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
