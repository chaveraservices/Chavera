import { useState, useRef, useEffect } from 'react';
import { Filter } from 'lucide-react';

// A small Excel-style filter attached to a table column header. Shares its
// value with the page's filter state, so the top filter bar and these stay
// in sync. mode="select" shows a searchable value list; mode="search" is a text box.
export default function ColumnFilter({
  label,
  mode = 'select',
  options = [],
  value = '',
  onChange,
  placeholder = 'Search…',
  alignRight = false,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const active = !!(value && String(value).length);
  const shown = mode === 'select'
    ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())).slice(0, 100)
    : [];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span>{label}</span>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={`Filter by ${label}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', lineHeight: 0 }}
      >
        <Filter size={13} color={active ? 'var(--primary-accent)' : '#94A3B8'} fill={active ? 'var(--primary-accent)' : 'none'} />
      </button>

      {open && (
        <div className="col-filter-menu" style={alignRight ? { right: 0 } : { left: 0 }}>
          {mode === 'search' ? (
            <input
              autoFocus
              className="input-field"
              placeholder={placeholder}
              value={value}
              onChange={e => onChange(e.target.value)}
              style={{ width: '100%' }}
            />
          ) : (
            <>
              <input
                className="input-field"
                placeholder="Search values…"
                value={q}
                onChange={e => setQ(e.target.value)}
                style={{ width: '100%', marginBottom: 6 }}
              />
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <div className={`col-filter-opt ${!value ? 'selected' : ''}`} onMouseDown={() => { onChange(''); setOpen(false); }}>All</div>
                {shown.map(o => (
                  <div key={o} className={`col-filter-opt ${o === value ? 'selected' : ''}`} onMouseDown={() => { onChange(o); setOpen(false); }}>{o}</div>
                ))}
                {shown.length === 0 && <div className="col-filter-opt" style={{ color: 'var(--text-muted)', cursor: 'default' }}>No values</div>}
              </div>
            </>
          )}
          {active && (
            <button type="button" className="col-filter-clear" onMouseDown={() => { onChange(''); setOpen(false); }}>
              Clear this filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
