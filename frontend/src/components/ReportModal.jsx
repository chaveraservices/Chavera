import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, BarChart3, Hash, Calendar, Search } from 'lucide-react';
import api from '../utils/api';
import SeriesAreaChart from './SeriesAreaChart';
import EntryDetailModal from './EntryDetailModal';
import CustomSelect from './CustomSelect';
import useProducts from '../utils/useProducts';
import useBodyScrollLock from '../utils/useBodyScrollLock';

const fmtNum = (n) => (n ?? 0).toLocaleString('en-IN');

// Date-range presets for the report's By-Date view. Each returns { from, to }
// as ISO strings (or null = open-ended).
const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
];
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const iso = (d) => (d ? new Date(d).toISOString() : null);
const presetRange = (preset) => {
  const now = new Date();
  switch (preset) {
    case 'today': { const s = startOfDay(now); return { from: iso(s), to: iso(new Date(s.getTime() + 86400000)) }; }
    case 'week': { const off = (now.getDay() + 6) % 7; return { from: iso(startOfDay(new Date(now.getTime() - off * 86400000))), to: null }; }
    case 'month': return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: null };
    case 'lastMonth': return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 1)) };
    default: return { from: null, to: null };
  }
};
const findCount = (arr, label) => (arr || []).find(x => (x.label || '').toUpperCase() === label.toUpperCase())?.count || 0;
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  const p = (x) => String(x).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
};

function Card({ label, value, sub, tone }) {
  return (
    <div className={`report-card ${tone ? `tone-${tone}` : ''}`}>
      <div className="report-card-label">{label}</div>
      <div className="report-card-value">{value}</div>
      {sub && <div className="report-card-sub">{sub}</div>}
    </div>
  );
}

/**
 * Summary Report — opened from the Dashboard. Two views:
 *  • All time: totals + an entries-per-series area chart.
 *  • By series: type a series number to inspect that 100-entry batch, with its
 *    entries listed newest-first.
 */
export default function ReportModal({ open, onClose }) {
  useBodyScrollLock(open);
  const { products: catalogue } = useProducts();

  const [view, setView] = useState('date');           // 'date' | 'series'
  const [product, setProduct] = useState('');          // product filter (both views)
  const [report, setReport] = useState(null);         // { series[], totals }
  const [loading, setLoading] = useState(false);

  // By-Date view
  const [preset, setPreset] = useState('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // By-Year view: pick a calendar year to inspect its entries (numbered 1..N).
  const [selectedYear, setSelectedYear] = useState(null);
  const [seriesData, setSeriesData] = useState(null); // { year, count, items }
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState('');
  const [listSearch, setListSearch] = useState('');   // filter within the entries list
  const [openContact, setOpenContact] = useState(null); // row-click detail

  // Load the series report when the modal opens or the product filter changes.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.post('/contact/series-report', { product })
      .then(res => { if (res.data.success) setReport(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, product]);

  // Reset transient state on close.
  useEffect(() => {
    if (!open) { setView('date'); setPreset('all'); setProduct(''); setCustom({ from: '', to: '' }); setSelectedYear(null); setSeriesData(null); setListSearch(''); setOpenContact(null); }
  }, [open]);

  // Fetch period analytics whenever the date range changes (By-Date view).
  useEffect(() => {
    if (!open) return;
    const range = preset === 'custom'
      ? { from: custom.from ? iso(custom.from) : null, to: custom.to ? iso(new Date(new Date(custom.to).getTime() + 86400000)) : null }
      : presetRange(preset);
    setAnalyticsLoading(true);
    api.post('/contact/analytics', { ...range, product })
      .then(res => { if (res.data.success) setAnalytics(res.data.data); })
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [open, preset, custom.from, custom.to, product]);

  useEffect(() => {
    if (!open) return;
    // When a detail card is open on top, let it handle Escape first.
    const onKey = (e) => { if (e.key === 'Escape' && !openContact) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, openContact]);

  // Load the selected year's entries (in date order, 1..N). The previous list
  // stays visible (dimmed) while the new one loads, so height never jumps.
  useEffect(() => {
    if (!open || view !== 'series' || selectedYear == null) { setSeriesData(null); setSeriesError(''); return; }
    setSeriesLoading(true);
    setSeriesError('');
    setListSearch('');
    api.post('/contact/series-entries', { year: selectedYear })
      .then(res => { if (res.data.success) { setSeriesData(res.data.data); setSeriesError(''); } })
      .catch((err) => {
        setSeriesError(
          err.response?.status === 404
            ? 'This report needs the updated server. Restart the backend, then try again.'
            : (err.response?.data?.message || 'Could not load entries for this year.')
        );
      })
      .finally(() => setSeriesLoading(false));
  }, [open, view, selectedYear, product]);

  if (!open) return null;

  const years = report?.series || [];   // [{ year, count, active, cancelled }]
  const hasSelection = selectedYear != null;

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 500 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="report-modal" role="dialog" aria-modal="true" aria-label="Summary report" onClick={e => e.stopPropagation()}>
        <div className="entry-modal-head">
          <span className="entry-avatar" style={{ background: 'var(--highlight)', color: 'var(--accent-text)' }}>
            <BarChart3 size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="entry-modal-name">Summary Report</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
              {view === 'date' ? 'By date range' : 'Browse a year’s entries'}
            </div>
          </div>
          <button type="button" className="entry-icon-btn" onClick={onClose} title="Close (Esc)"><X size={18} /></button>
        </div>

        {/* View toggle */}
        <div className="report-tabs">
          <button type="button" className={`report-tab ${view === 'date' ? 'active' : ''}`} onClick={() => setView('date')}>
            <Calendar size={14} /> By Date
          </button>
          <button type="button" className={`report-tab ${view === 'series' ? 'active' : ''}`} onClick={() => setView('series')}>
            <Hash size={14} /> By Year
          </button>

          {/* Product filter — scopes both the cards and the series graph. */}
          <div className="report-product">
            <CustomSelect
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              options={[{ label: 'All products', value: '' }, ...catalogue.map(p => ({ label: p, value: p }))]}
              placeholder="All products"
            />
          </div>
        </div>

        <div className="report-body">
          {view === 'date' ? (
            <>
              {/* Date-range presets */}
              <div className="report-presets">
                {DATE_PRESETS.map(p => (
                  <button key={p.key} type="button" className={`report-preset ${preset === p.key ? 'active' : ''}`} onClick={() => setPreset(p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="report-custom">
                  <label>From <input type="date" value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} /></label>
                  <label>To <input type="date" value={custom.to} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} /></label>
                </div>
              )}

              <div className="report-cards" style={{ marginTop: 14, opacity: analyticsLoading ? 0.55 : 1 }}>
                <Card label="Total Entries" value={fmtNum(analytics?.total)} sub={preset === 'all' ? 'all time' : 'in this period'} />
                <Card label="Dealers" value={fmtNum(findCount(analytics?.byCategory, 'DEALER'))} tone="green" />
                <Card label="Customers" value={fmtNum(findCount(analytics?.byCategory, 'CUSTOMER'))} tone="green" />
                <Card label="Cancelled" value={fmtNum(analytics?.cancelledCount)} sub="bills cancelled" tone="amber" />
              </div>

              <div className="report-graph">
                <div className="report-graph-title">Entries per year · {product || 'all products'}</div>
                <SeriesAreaChart data={report?.series} onPick={(y) => { setView('series'); setSelectedYear(y); }} />
              </div>
            </>
          ) : loading && !report ? (
            <div style={{ color: 'var(--text-muted)', padding: '24px 0' }}>Loading report…</div>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 12 }}>
                Pick a year to see its entries, numbered 1&hairsp;…&hairsp;N by date. The number resets each year.
              </p>
              <div className="report-presets">
                {years.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No entries yet.</span>
                ) : years.map(y => (
                  <button key={y.year} type="button"
                    title={`Year ${y.year}`}
                    className={`report-preset ${selectedYear === y.year ? 'active' : ''}`}
                    onClick={() => setSelectedYear(selectedYear === y.year ? null : y.year)}>
                    {y.letter || y.year} · {fmtNum(y.count)}
                  </button>
                ))}
                {hasSelection && (
                  <button type="button" className="report-preset"
                    onClick={() => { setSelectedYear(null); setSeriesData(null); }}>
                    Clear
                  </button>
                )}
              </div>

              {!hasSelection ? (
                <div className="report-graph" style={{ marginTop: 14 }}>
                  <div className="report-graph-title">Entries per year · {product || 'all products'}</div>
                  <SeriesAreaChart data={report?.series} highlight={selectedYear}
                    onPick={(y) => setSelectedYear(y)} />
                </div>
              ) : seriesError ? (
                <div style={{ padding: '10px 14px', margin: '14px 0', background: '#3B1A1A', color: 'var(--danger)', borderRadius: 8, fontSize: '0.85rem' }}>
                  {seriesError}
                </div>
              ) : seriesData ? (() => {
                // Filter within the year (code / name / phone / business).
                const q = listSearch.trim().toLowerCase();
                const codeOf = (it) => it.entry_code || '';
                const filtered = q
                  ? seriesData.items.filter(it =>
                    codeOf(it).toLowerCase().includes(q) ||
                    (it.full_name || '').toLowerCase().includes(q) ||
                    (it.phone_1 || '').includes(q) ||
                    (it.business_name || '').toLowerCase().includes(q))
                  : seriesData.items;
                return (
                  // Dim (not remove) while a new year loads, so the height holds.
                  <div style={{ opacity: seriesLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                    <div className="report-cards" style={{ marginTop: 4 }}>
                      <Card label="Total Entries" value={fmtNum(seriesData.count)} sub={`${seriesData.letter ? `series ${seriesData.letter} · ` : ''}${seriesData.year}`} />
                      <Card label="Active" value={fmtNum(seriesData.items.filter(i => !i.cancelled).length)} tone="green" />
                      <Card label="Cancelled" value={fmtNum(seriesData.items.filter(i => i.cancelled).length)} tone="amber" />
                    </div>

                    <div className="report-list-head">
                      All Entries <span className="report-count">{seriesData.count}</span>
                      <span className="report-newest">in date order</span>
                    </div>

                    {seriesData.items.length > 0 && (
                      <div className="report-search">
                        <Search size={15} />
                        <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="Search name, entry no or phone…" />
                        {listSearch && <button type="button" className="entry-icon-btn" onClick={() => setListSearch('')}><X size={14} /></button>}
                      </div>
                    )}

                    <div className="report-list">
                      {seriesData.items.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px 0' }}>No entries in this year yet.</div>
                      ) : filtered.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px 0' }}>No matches for “{listSearch}”.</div>
                      ) : filtered.map(it => (
                        <button type="button" key={it._id} className={`report-list-row is-click ${it.cancelled ? 'is-cancelled' : ''}`} onClick={() => setOpenContact(it)}>
                          <span className="report-list-no">{codeOf(it)}</span>
                          <span className="report-list-name">{it.honorific ? `${it.honorific} ` : ''}{it.full_name}</span>
                          <span className="report-list-date">{fmtDate(it.contact_date || it.createdAt)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })() : seriesLoading ? (
                <div style={{ color: 'var(--text-muted)', padding: '20px 0' }}>Loading entries…</div>
              ) : (
                <div style={{ color: 'var(--text-muted)', padding: '20px 0' }}>No entries found for this year.</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Clicking an entry opens its detail on top of the report (read-only). */}
      <EntryDetailModal contact={openContact} onClose={() => setOpenContact(null)} zIndex={600} />
    </div>,
    document.body
  );
}
