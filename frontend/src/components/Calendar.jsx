import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Local 'YYYY-MM-DD'. toISOString() would shift the day for anyone not on UTC,
// silently moving a range boundary.
const key = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Six rows of seven, always — a fixed height stops the popover resizing as you
// page between months.
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date: d, key: key(d), outside: d.getMonth() !== month };
  });
}

/**
 * Range calendar. Click once to set the start, again to set the end; clicking
 * a date before the start moves the start instead, so you can't build an
 * invalid range.
 *
 * value: { from, to } as 'YYYY-MM-DD' | null
 */
export default function Calendar({ value, onChange }) {
  const todayKey = key(new Date());
  const anchor = value.from ? new Date(`${value.from}T00:00:00`) : new Date();
  const [view, setView] = useState({ y: anchor.getFullYear(), m: anchor.getMonth() });
  const [mode, setMode] = useState('days'); // 'days' | 'months'
  const [hover, setHover] = useState(null);

  const step = (n) => {
    const d = new Date(view.y, view.m + n, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const pick = (k) => {
    // No start yet, or a complete range already — begin a new one.
    if (!value.from || (value.from && value.to)) return onChange({ from: k, to: null });
    if (k < value.from) return onChange({ from: k, to: null });
    onChange({ from: value.from, to: k });
  };

  // While picking the end, preview the band under the cursor.
  const previewTo = value.from && !value.to && hover && hover >= value.from ? hover : null;
  const rangeEnd = value.to || previewTo;

  const cellState = (k) => {
    const isStart = value.from === k;
    const isEnd = rangeEnd === k;
    const inside = value.from && rangeEnd && k > value.from && k < rangeEnd;
    return { isStart, isEnd, inside, isEdge: isStart || isEnd };
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => (mode === 'days' ? step(-1) : setView(v => ({ ...v, y: v.y - 1 })))}
          aria-label={mode === 'days' ? 'Previous month' : 'Previous year'}>
          <ChevronLeft size={16} />
        </button>
        <button type="button" className="cal-title" onClick={() => setMode(m => (m === 'days' ? 'months' : 'days'))}>
          {mode === 'days' ? `${MONTHS[view.m]} ${view.y}` : view.y}
        </button>
        <button type="button" className="cal-nav" onClick={() => (mode === 'days' ? step(1) : setView(v => ({ ...v, y: v.y + 1 })))}
          aria-label={mode === 'days' ? 'Next month' : 'Next year'}>
          <ChevronRight size={16} />
        </button>
      </div>

      {mode === 'months' ? (
        <div className="cal-months">
          {MONTHS_SHORT.map((mn, i) => (
            <button
              type="button"
              key={mn}
              className={`cal-month ${i === view.m ? 'is-current' : ''}`}
              onClick={() => { setView(v => ({ ...v, m: i })); setMode('days'); }}
            >
              {mn}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="cal-dow">
            {DOW.map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="cal-grid" onMouseLeave={() => setHover(null)}>
            {monthGrid(view.y, view.m).map(({ date, key: k, outside }) => {
              const { isStart, isEnd, inside, isEdge } = cellState(k);
              return (
                <div
                  key={k}
                  className={[
                    'cal-cell',
                    inside ? 'in-range' : '',
                    isStart && rangeEnd && rangeEnd !== k ? 'band-start' : '',
                    isEnd && value.from && value.from !== k ? 'band-end' : '',
                  ].join(' ').trim()}
                >
                  <button
                    type="button"
                    className={[
                      'cal-day',
                      outside ? 'is-outside' : '',
                      isEdge ? 'is-selected' : '',
                      k === todayKey && !isEdge ? 'is-today' : '',
                    ].join(' ').trim()}
                    onClick={() => pick(k)}
                    onMouseEnter={() => setHover(k)}
                    aria-label={date.toDateString()}
                    aria-pressed={isEdge}
                  >
                    {date.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
